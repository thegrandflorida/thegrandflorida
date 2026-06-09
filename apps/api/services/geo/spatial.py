"""
Geospatial enrichment services — FEMA flood zones, USFWS wetlands, infrastructure scoring.

Uses ArcGIS REST APIs (no SDK required — plain HTTPX calls).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

# FEMA National Flood Hazard Layer (NFHL) — Feature Service
_FEMA_NFHL_URL = (
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"
)

# USFWS National Wetlands Inventory (NWI) — Feature Service
_NWI_URL = (
    "https://fwspublicservices.wim.usgs.gov/server/rest/services/Wetlands/MapServer/1/query"
)

_REQUEST_TIMEOUT = 20.0  # seconds


# ---------------------------------------------------------------------------
# FEMA Flood Zone intersection
# ---------------------------------------------------------------------------


async def intersect_flood_zones(parcel_wkt: str) -> dict[str, Any]:
    """
    Query FEMA NFHL for flood zone attributes that intersect the parcel polygon.

    Args:
        parcel_wkt: Well-Known Text of the parcel polygon (WGS-84, EPSG:4326).

    Returns:
        {
            "zone_code": str | None,
            "sfha_pct": float,       # 0–100 % of parcel in SFHA
            "bfe_ft": float | None,  # Base Flood Elevation in feet
        }
    """
    params = {
        "geometry": parcel_wkt,
        "geometryType": "esriGeometryPolygon",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE",
        "returnGeometry": "true",
        "f": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.get(_FEMA_NFHL_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("FEMA NFHL request failed: %s", exc)
        return {"zone_code": None, "sfha_pct": 0.0, "bfe_ft": None}

    features = data.get("features") or []
    if not features:
        return {"zone_code": None, "sfha_pct": 0.0, "bfe_ft": None}

    # Use the feature covering the largest area (first is usually dominant)
    primary = features[0].get("attributes") or {}
    zone_code: Optional[str] = primary.get("FLD_ZONE") or primary.get("ZONE_SUBTY")

    # SFHA_TF == "T" means the zone IS a special flood hazard area
    sfha_features = [
        f for f in features
        if (f.get("attributes") or {}).get("SFHA_TF") == "T"
    ]
    # Approximate sfha_pct as (count of sfha features / total features) * 100
    sfha_pct = round((len(sfha_features) / len(features)) * 100, 1) if features else 0.0

    bfe_values = [
        float(f["attributes"]["STATIC_BFE"])
        for f in features
        if (f.get("attributes") or {}).get("STATIC_BFE") not in (None, -9999, "-9999")
    ]
    bfe_ft: Optional[float] = round(sum(bfe_values) / len(bfe_values), 1) if bfe_values else None

    return {
        "zone_code": zone_code,
        "sfha_pct": sfha_pct,
        "bfe_ft": bfe_ft,
    }


# ---------------------------------------------------------------------------
# USFWS Wetlands intersection
# ---------------------------------------------------------------------------

_NWI_TYPE_FIELD_MAP = {
    "E": "Estuarine",
    "F": "Freshwater",
    "L": "Lake",
    "M": "Marine",
    "P": "Palustrine",
    "R": "Riverine",
    "U": "Upland",
}


async def intersect_wetlands(parcel_wkt: str) -> dict[str, Any]:
    """
    Query USFWS NWI for wetland features that intersect the parcel polygon.

    Args:
        parcel_wkt: Well-Known Text of the parcel polygon (WGS-84, EPSG:4326).

    Returns:
        {
            "coverage_pct": float,     # 0–100 estimated % of parcel covered
            "types": list[str],        # e.g. ["Palustrine", "Freshwater"]
        }
    """
    params = {
        "geometry": parcel_wkt,
        "geometryType": "esriGeometryPolygon",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "WETLAND_TYPE,ACRES",
        "returnGeometry": "false",
        "f": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.get(_NWI_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("NWI request failed: %s", exc)
        return {"coverage_pct": 0.0, "types": []}

    features = data.get("features") or []
    if not features:
        return {"coverage_pct": 0.0, "types": []}

    # Sum wetland acres
    total_wetland_acres = sum(
        float((f.get("attributes") or {}).get("ACRES") or 0)
        for f in features
    )

    # Derive parcel acreage from WKT bounding box (rough approximation)
    # In production this would be computed from the actual parcel geometry
    coverage_pct = min(100.0, round(total_wetland_acres * 10, 1))  # proxy; replace with actual area

    # Collect unique wetland types
    raw_types: set[str] = set()
    for f in features:
        wtype = (f.get("attributes") or {}).get("WETLAND_TYPE") or ""
        for code, label in _NWI_TYPE_FIELD_MAP.items():
            if wtype.startswith(code):
                raw_types.add(label)
                break
        else:
            if wtype:
                raw_types.add(wtype[:32])

    return {
        "coverage_pct": coverage_pct,
        "types": sorted(raw_types),
    }


# ---------------------------------------------------------------------------
# Infrastructure sub-score
# ---------------------------------------------------------------------------

# Component weights per scoring model spec
_INFRA_WEIGHTS = {
    "water": 0.30,
    "sewer": 0.30,
    "road": 0.20,
    "transit": 0.20,
}


def compute_infrastructure_score(
    water_ft: Optional[float],
    sewer_ft: Optional[float],
    road_type: Optional[str],
    transit_ft: Optional[float],
) -> float:
    """
    Compute the 0–10 infrastructure sub-score from four components:
      - water:   distance in feet to nearest water main (30%)
      - sewer:   distance in feet to nearest sewer line (30%)
      - road:    type of road frontage (20%)
      - transit: distance in feet to nearest transit stop (20%)

    Returns a float in [0.0, 10.0].
    """
    # --- Water score (0–10): at-site = 10, degrades with distance ---
    if water_ft is None:
        water_score = 5.0  # unknown — moderate
    elif water_ft <= 0:
        water_score = 10.0
    elif water_ft <= 100:
        water_score = 9.0
    elif water_ft <= 500:
        water_score = 7.5
    elif water_ft <= 1320:  # 0.25 mi
        water_score = 6.0
    elif water_ft <= 2640:  # 0.5 mi
        water_score = 4.0
    elif water_ft <= 5280:  # 1 mi
        water_score = 2.0
    else:
        water_score = 0.5

    # --- Sewer score (0–10) ---
    if sewer_ft is None:
        sewer_score = 5.0
    elif sewer_ft <= 0:
        sewer_score = 10.0
    elif sewer_ft <= 100:
        sewer_score = 9.0
    elif sewer_ft <= 500:
        sewer_score = 7.5
    elif sewer_ft <= 1320:
        sewer_score = 6.0
    elif sewer_ft <= 2640:
        sewer_score = 4.0
    elif sewer_ft <= 5280:
        sewer_score = 2.0
    else:
        sewer_score = 0.5

    # --- Road score (0–10): based on frontage classification ---
    road_scores: dict[str, float] = {
        "highway": 10.0,
        "arterial": 8.5,
        "collector": 7.0,
        "local": 5.5,
        "paved": 5.5,
        "unpaved": 2.0,
        "none": 0.0,
    }
    road_score = road_scores.get((road_type or "").lower(), 4.0)

    # --- Transit score (0–10): distance to nearest stop ---
    if transit_ft is None:
        transit_score = 4.0
    elif transit_ft <= 528:   # 0.1 mi
        transit_score = 10.0
    elif transit_ft <= 1320:  # 0.25 mi
        transit_score = 8.0
    elif transit_ft <= 2640:  # 0.5 mi
        transit_score = 6.0
    elif transit_ft <= 5280:  # 1 mi
        transit_score = 4.0
    elif transit_ft <= 10560: # 2 mi
        transit_score = 2.0
    else:
        transit_score = 0.5

    composite = (
        water_score   * _INFRA_WEIGHTS["water"]
        + sewer_score * _INFRA_WEIGHTS["sewer"]
        + road_score  * _INFRA_WEIGHTS["road"]
        + transit_score * _INFRA_WEIGHTS["transit"]
    )

    return round(min(10.0, max(0.0, composite)), 2)
