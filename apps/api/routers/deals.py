"""
Deals router — search, deal cards, scoring detail, underwriting, history.
Prefix: /deals   Tags: deals
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..dependencies import get_current_user, get_db

router = APIRouter(prefix="/deals", tags=["deals"])

# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class DealListItem(BaseModel):
    listing_id: UUID
    property_id: UUID
    situs_address: Optional[str] = None
    county_id: int
    list_price: Optional[float] = None
    lot_size_acres: Optional[float] = None
    days_on_market: Optional[int] = None
    overall_score: Optional[float] = None
    score_grade: Optional[str] = None
    status: str
    listing_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class DealListResponse(BaseModel):
    items: List[DealListItem]
    page: int
    per_page: int
    total: int
    total_pages: int


class SoftFlag(BaseModel):
    flag: str
    severity: str  # info | warning | critical
    detail: Optional[str] = None


class DealCardParcel(BaseModel):
    land_use_code: Optional[str] = None
    assessed_value: Optional[float] = None
    land_value: Optional[float] = None
    annual_taxes: Optional[float] = None
    tax_year: Optional[int] = None
    assessed_to_market_ratio: Optional[float] = None


class DealCardZoning(BaseModel):
    zoning_code: Optional[str] = None
    zoning_description: Optional[str] = None
    zoning_category: Optional[str] = None
    future_land_use: Optional[str] = None
    max_density_units_per_acre: Optional[float] = None
    max_height_ft: Optional[float] = None
    max_far: Optional[float] = None
    upzoning_potential: Optional[str] = None
    allowable_uses: List[str] = Field(default_factory=list)
    conditional_uses: List[str] = Field(default_factory=list)
    overlay_districts: List[str] = Field(default_factory=list)


class DealCardFlood(BaseModel):
    fema_zone_code: Optional[str] = None
    is_special_flood_hazard: bool = False
    pct_parcel_in_flood_zone: Optional[float] = None
    base_flood_elevation_ft: Optional[float] = None


class DealCardWetlands(BaseModel):
    has_wetlands: bool = False
    wetland_pct: Optional[float] = None
    wetland_types: List[str] = Field(default_factory=list)
    sfwmd_jurisdiction: bool = False
    army_corps_jurisdiction: bool = False
    mitigation_bank_available: bool = False


class DealCardUtility(BaseModel):
    water_available: bool = False
    water_at_site: bool = False
    sewer_available: bool = False
    sewer_at_site: bool = False
    septic_permitted: bool = False
    electric_available: bool = False
    fiber_available: bool = False
    road_frontage_type: Optional[str] = None
    road_classification: Optional[str] = None


class DealCardScore(BaseModel):
    overall_score: Optional[float] = None
    score_grade: Optional[str] = None
    location_score: Optional[float] = None
    zoning_upside_score: Optional[float] = None
    value_dislocation_score: Optional[float] = None
    distress_signal_score: Optional[float] = None
    environmental_risk_score: Optional[float] = None
    market_velocity_score: Optional[float] = None
    utility_readiness_score: Optional[float] = None
    bonus_points: Optional[float] = None
    risk_flags: List[str] = Field(default_factory=list)
    upside_flags: List[str] = Field(default_factory=list)
    in_opportunity_zone: bool = False
    in_cra: bool = False
    assemblage_potential: bool = False
    ai_summary: Optional[str] = None
    scored_at: Optional[datetime] = None


class UnderwritingSnapshotModel(BaseModel):
    id: UUID
    listing_id: UUID
    listing_price: float
    gross_acreage: Optional[float] = None
    units_allowed: Optional[int] = None
    price_per_acre: Optional[float] = None
    land_cost_per_buildable_unit: Optional[float] = None
    hard_cost_total: Optional[float] = None
    soft_cost_total: Optional[float] = None
    contingency: Optional[float] = None
    financing_cost: Optional[float] = None
    total_development_cost: Optional[float] = None
    gross_potential_rent: Optional[float] = None
    effective_gross_income: Optional[float] = None
    operating_expenses: Optional[float] = None
    noi: Optional[float] = None
    stabilized_value: Optional[float] = None
    developer_profit: Optional[float] = None
    developer_profit_margin: Optional[float] = None
    return_on_cost: Optional[float] = None
    roc_vs_cap_spread: Optional[float] = None
    user_override_flags: dict = Field(default_factory=dict)
    created_at: datetime


class DealCardResponse(BaseModel):
    listing_id: UUID
    property_id: UUID
    situs_address: Optional[str] = None
    county_id: int
    county_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    lot_size_acres: Optional[float] = None
    lot_size_sqft: Optional[float] = None
    frontage_ft: Optional[float] = None
    is_corner_lot: bool = False
    is_vacant: bool = False
    is_distressed: bool = False
    has_code_violations: bool = False
    has_tax_liens: bool = False
    has_lis_pendens: bool = False
    list_price: Optional[float] = None
    price_per_acre: Optional[float] = None
    days_on_market: Optional[int] = None
    listing_source: Optional[str] = None
    listing_url: Optional[str] = None
    description: Optional[str] = None
    photos: List[dict] = Field(default_factory=list)
    status: str
    parcel: Optional[DealCardParcel] = None
    zoning: Optional[DealCardZoning] = None
    flood: Optional[DealCardFlood] = None
    wetlands: Optional[DealCardWetlands] = None
    utility: Optional[DealCardUtility] = None
    score: Optional[DealCardScore] = None
    latest_underwriting: Optional[UnderwritingSnapshotModel] = None
    watchlist_status: Optional[str] = None
    soft_flags: List[SoftFlag] = Field(default_factory=list)


class OpportunityScoreDetail(BaseModel):
    property_id: UUID
    overall_score: float
    score_grade: str
    location_score: Optional[float] = None
    zoning_upside_score: Optional[float] = None
    value_dislocation_score: Optional[float] = None
    distress_signal_score: Optional[float] = None
    environmental_risk_score: Optional[float] = None
    market_velocity_score: Optional[float] = None
    utility_readiness_score: Optional[float] = None
    bonus_points: Optional[float] = None
    score_weights: dict = Field(default_factory=dict)
    score_inputs: dict = Field(default_factory=dict)
    risk_flags: List[str] = Field(default_factory=list)
    upside_flags: List[str] = Field(default_factory=list)
    in_opportunity_zone: bool = False
    in_cra: bool = False
    assemblage_potential: bool = False
    ai_summary: Optional[str] = None
    ai_risk_analysis: Optional[str] = None
    ai_upside_analysis: Optional[str] = None
    scored_at: datetime
    scoring_version: Optional[str] = None
    improvement_levers: List[dict] = Field(default_factory=list)


class ScoreHistoryPoint(BaseModel):
    scored_at: datetime
    overall_score: float
    score_grade: str


# ---------------------------------------------------------------------------
# Soft flag computation
# ---------------------------------------------------------------------------

def _compute_soft_flags(row: dict[str, Any]) -> list[SoftFlag]:
    flags: list[SoftFlag] = []

    if row.get("has_lis_pendens"):
        flags.append(SoftFlag(flag="Lis Pendens", severity="critical", detail="Active lis pendens on title"))
    if row.get("has_tax_liens"):
        flags.append(SoftFlag(flag="Tax Liens", severity="warning", detail="Outstanding tax liens"))
    if row.get("has_code_violations"):
        flags.append(SoftFlag(flag="Code Violations", severity="warning", detail="Open code violations on record"))
    if row.get("is_special_flood_hazard"):
        zone = row.get("fema_zone_code") or "SFHA"
        flags.append(SoftFlag(flag=f"FEMA Flood Zone {zone}", severity="warning", detail="Special Flood Hazard Area"))
    wetland_pct = row.get("wetland_pct") or 0
    if wetland_pct > 30:
        flags.append(SoftFlag(flag="High Wetland Coverage", severity="critical", detail=f"{wetland_pct:.0f}% wetlands"))
    elif wetland_pct > 10:
        flags.append(SoftFlag(flag="Wetlands Present", severity="warning", detail=f"{wetland_pct:.0f}% wetlands"))
    if row.get("road_frontage_type") == "none":
        flags.append(SoftFlag(flag="No Road Frontage", severity="critical", detail="Property has no road access"))
    if not row.get("water_available") and not row.get("water_at_site"):
        flags.append(SoftFlag(flag="No Water Service", severity="warning", detail="No public water access confirmed"))
    if not row.get("sewer_available") and not row.get("sewer_at_site") and not row.get("septic_permitted"):
        flags.append(SoftFlag(flag="No Sewer / Septic", severity="warning", detail="No sewer or septic option confirmed"))
    if row.get("in_opportunity_zone"):
        flags.append(SoftFlag(flag="Opportunity Zone", severity="info", detail="HUD Qualified Opportunity Zone — potential tax benefits"))
    if row.get("in_cra"):
        flags.append(SoftFlag(flag="CRA District", severity="info", detail="Community Redevelopment Area — potential incentives"))
    if row.get("assemblage_potential"):
        flags.append(SoftFlag(flag="Assemblage Potential", severity="info", detail="Adjacent parcels may support larger development"))

    return flags


def _build_improvement_levers(score_inputs: dict, score_weights: dict) -> list[dict]:
    """Surface the lowest-scoring components as improvement levers."""
    component_labels = {
        "price_score": "Negotiate a lower purchase price",
        "zoning_score": "Pursue rezoning or conditional use approval",
        "population_score": "Submarket with slower growth — factor into projections",
        "flood_score": "LOMA / LOMR to remove or reduce flood designation",
        "comps_score": "Wait for more comparable sales to establish value",
        "dev_activity_score": "Limited nearby development activity",
        "utility_score": "Extend water / sewer to the site",
        "wetland_score": "Wetland mitigation or avoidance plan needed",
        "interstate_score": "Distant from interstate — impacts industrial / commercial value",
    }
    levers = []
    for key, label in component_labels.items():
        val = score_inputs.get(key)
        if val is not None and val < 50:
            weight = score_weights.get(key.replace("_score", ""), 0)
            levers.append({"component": key, "score": round(val, 1), "weight": weight, "lever": label})
    levers.sort(key=lambda x: x["score"])
    return levers[:3]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=DealListResponse)
async def search_deals(
    q: Optional[str] = Query(default=None, description="Text search on address"),
    county_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    sort_by: str = Query(default="score", pattern="^(score|price|acres|dom|date)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> DealListResponse:
    """Full-text search on deals using pg_trgm ILIKE."""
    where_clauses: list[str] = ["l.is_current = TRUE"]
    params: dict[str, Any] = {}

    if q:
        where_clauses.append(
            "(p.address_street ILIKE :q OR p.address_city ILIKE :q)"
        )
        params["q"] = f"%{q}%"

    if county_id is not None:
        where_clauses.append("p.county_id = :county_id")
        params["county_id"] = county_id

    if status:
        where_clauses.append("l.status = :status")
        params["status"] = status

    if min_price is not None:
        where_clauses.append("l.list_price >= :min_price")
        params["min_price"] = min_price

    if max_price is not None:
        where_clauses.append("l.list_price <= :max_price")
        params["max_price"] = max_price

    sort_expr = {
        "score": "os.overall_score DESC NULLS LAST",
        "price": "l.list_price ASC NULLS LAST",
        "acres": "p.lot_size_acres DESC NULLS LAST",
        "dom": "l.days_on_market DESC NULLS LAST",
        "date": "l.list_date DESC NULLS LAST",
    }[sort_by]

    where_sql = "WHERE " + " AND ".join(where_clauses)

    base = f"""
        FROM listings l
        JOIN properties p ON p.id = l.property_id
        LEFT JOIN opportunity_scores os ON os.property_id = p.id
    """

    count_row = await db.fetch_one(f"SELECT COUNT(*) AS total {base} {where_sql}", values=params)
    total = count_row["total"] if count_row else 0

    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    rows = await db.fetch_all(
        f"""
        SELECT
            l.id            AS listing_id,
            l.property_id,
            l.list_price,
            l.price_per_acre,
            l.days_on_market,
            l.status,
            l.listing_url,
            l.photos,
            p.address_street AS situs_address,
            p.county_id,
            p.lot_size_acres,
            os.overall_score,
            os.score_grade
        {base}
        {where_sql}
        ORDER BY {sort_expr}
        LIMIT :limit OFFSET :offset
        """,
        values=params,
    )

    items = []
    for r in rows:
        row = dict(r)
        photos = row.get("photos") or []
        thumbnail = photos[0]["url"] if photos else None
        items.append(
            DealListItem(
                listing_id=row["listing_id"],
                property_id=row["property_id"],
                situs_address=row.get("situs_address"),
                county_id=row.get("county_id") or 0,
                list_price=row.get("list_price"),
                lot_size_acres=row.get("lot_size_acres"),
                days_on_market=row.get("days_on_market"),
                overall_score=row.get("overall_score"),
                score_grade=row.get("score_grade"),
                status=row.get("status") or "active",
                listing_url=row.get("listing_url"),
                thumbnail_url=thumbnail,
            )
        )

    return DealListResponse(
        items=items,
        page=page,
        per_page=per_page,
        total=total,
        total_pages=max(1, -(-total // per_page)),
    )


@router.get("/{listing_id}", response_model=DealCardResponse)
async def get_deal_card(
    listing_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> DealCardResponse:
    """Full deal card — all joined tables plus soft flags."""
    row = await db.fetch_one(
        """
        SELECT
            l.id            AS listing_id,
            l.property_id,
            l.list_price,
            l.price_per_acre,
            l.days_on_market,
            l.listing_source,
            l.listing_url,
            l.description,
            l.photos,
            l.status,
            p.address_street  AS situs_address,
            p.county_id,
            c.name            AS county_name,
            p.latitude,
            p.longitude,
            p.lot_size_acres,
            p.lot_size_sqft,
            p.frontage_ft,
            p.is_corner_lot,
            p.is_vacant,
            p.is_distressed,
            p.has_code_violations,
            p.has_tax_liens,
            p.has_lis_pendens,
            -- parcel
            pd.land_use_code,
            pd.assessed_value,
            pd.land_value,
            pd.annual_taxes,
            pd.tax_year,
            pd.assessed_to_market_ratio,
            -- zoning
            z.zoning_code,
            z.zoning_description,
            z.zoning_category,
            z.future_land_use,
            z.max_density_units_per_acre,
            z.max_height_ft,
            z.max_far,
            z.upzoning_potential,
            z.allowable_uses,
            z.conditional_uses,
            z.overlay_districts,
            -- flood
            fz.fema_zone_code,
            fz.is_special_flood_hazard,
            fz.pct_parcel_in_flood_zone,
            fz.base_flood_elevation_ft,
            -- wetlands
            w.has_wetlands,
            w.wetland_pct,
            w.wetland_types,
            w.sfwmd_jurisdiction,
            w.army_corps_jurisdiction,
            w.mitigation_bank_available,
            -- utility
            u.water_available,
            u.water_at_site,
            u.sewer_available,
            u.sewer_at_site,
            u.septic_permitted,
            u.electric_available,
            u.fiber_available,
            u.road_frontage_type,
            u.road_classification,
            -- score
            os.overall_score,
            os.score_grade,
            os.location_score,
            os.zoning_upside_score,
            os.value_dislocation_score,
            os.distress_signal_score,
            os.environmental_risk_score,
            os.market_velocity_score,
            os.utility_readiness_score,
            os.bonus_points,
            os.risk_flags,
            os.upside_flags,
            os.in_opportunity_zone,
            os.in_cra,
            os.assemblage_potential,
            os.ai_summary,
            os.scored_at,
            -- watchlist
            f.stage          AS watchlist_status
        FROM listings          l
        JOIN properties        p  ON p.id          = l.property_id
        JOIN counties          c  ON c.id          = p.county_id
        LEFT JOIN parcel_data  pd ON pd.property_id = p.id
        LEFT JOIN zoning        z  ON z.property_id  = p.id
        LEFT JOIN flood_zones  fz ON fz.property_id = p.id
        LEFT JOIN wetlands      w  ON w.property_id  = p.id
        LEFT JOIN utility_access u ON u.property_id = p.id
        LEFT JOIN opportunity_scores os ON os.property_id = p.id
        LEFT JOIN favorites     f  ON f.property_id = p.id AND f.user_id = :user_id
        WHERE l.id = :listing_id
        """,
        values={"listing_id": str(listing_id), "user_id": current_user["id"]},
    )

    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")

    r = dict(row)

    # Latest underwriting snapshot
    uw_row = await db.fetch_one(
        """
        SELECT * FROM underwriting_snapshots
        WHERE listing_id = :listing_id
        ORDER BY created_at DESC
        LIMIT 1
        """,
        values={"listing_id": str(listing_id)},
    )

    latest_uw: Optional[UnderwritingSnapshotModel] = None
    if uw_row:
        uw = dict(uw_row)
        latest_uw = UnderwritingSnapshotModel(**uw)

    soft_flags = _compute_soft_flags(r)

    return DealCardResponse(
        listing_id=r["listing_id"],
        property_id=r["property_id"],
        situs_address=r.get("situs_address"),
        county_id=r.get("county_id") or 0,
        county_name=r.get("county_name"),
        latitude=r.get("latitude"),
        longitude=r.get("longitude"),
        lot_size_acres=r.get("lot_size_acres"),
        lot_size_sqft=r.get("lot_size_sqft"),
        frontage_ft=r.get("frontage_ft"),
        is_corner_lot=bool(r.get("is_corner_lot")),
        is_vacant=bool(r.get("is_vacant")),
        is_distressed=bool(r.get("is_distressed")),
        has_code_violations=bool(r.get("has_code_violations")),
        has_tax_liens=bool(r.get("has_tax_liens")),
        has_lis_pendens=bool(r.get("has_lis_pendens")),
        list_price=r.get("list_price"),
        price_per_acre=r.get("price_per_acre"),
        days_on_market=r.get("days_on_market"),
        listing_source=r.get("listing_source"),
        listing_url=r.get("listing_url"),
        description=r.get("description"),
        photos=r.get("photos") or [],
        status=r.get("status") or "active",
        parcel=DealCardParcel(
            land_use_code=r.get("land_use_code"),
            assessed_value=r.get("assessed_value"),
            land_value=r.get("land_value"),
            annual_taxes=r.get("annual_taxes"),
            tax_year=r.get("tax_year"),
            assessed_to_market_ratio=r.get("assessed_to_market_ratio"),
        ),
        zoning=DealCardZoning(
            zoning_code=r.get("zoning_code"),
            zoning_description=r.get("zoning_description"),
            zoning_category=r.get("zoning_category"),
            future_land_use=r.get("future_land_use"),
            max_density_units_per_acre=r.get("max_density_units_per_acre"),
            max_height_ft=r.get("max_height_ft"),
            max_far=r.get("max_far"),
            upzoning_potential=r.get("upzoning_potential"),
            allowable_uses=r.get("allowable_uses") or [],
            conditional_uses=r.get("conditional_uses") or [],
            overlay_districts=r.get("overlay_districts") or [],
        ),
        flood=DealCardFlood(
            fema_zone_code=r.get("fema_zone_code"),
            is_special_flood_hazard=bool(r.get("is_special_flood_hazard")),
            pct_parcel_in_flood_zone=r.get("pct_parcel_in_flood_zone"),
            base_flood_elevation_ft=r.get("base_flood_elevation_ft"),
        ),
        wetlands=DealCardWetlands(
            has_wetlands=bool(r.get("has_wetlands")),
            wetland_pct=r.get("wetland_pct"),
            wetland_types=r.get("wetland_types") or [],
            sfwmd_jurisdiction=bool(r.get("sfwmd_jurisdiction")),
            army_corps_jurisdiction=bool(r.get("army_corps_jurisdiction")),
            mitigation_bank_available=bool(r.get("mitigation_bank_available")),
        ),
        utility=DealCardUtility(
            water_available=bool(r.get("water_available")),
            water_at_site=bool(r.get("water_at_site")),
            sewer_available=bool(r.get("sewer_available")),
            sewer_at_site=bool(r.get("sewer_at_site")),
            septic_permitted=bool(r.get("septic_permitted")),
            electric_available=bool(r.get("electric_available")),
            fiber_available=bool(r.get("fiber_available")),
            road_frontage_type=r.get("road_frontage_type"),
            road_classification=r.get("road_classification"),
        ),
        score=DealCardScore(
            overall_score=r.get("overall_score"),
            score_grade=r.get("score_grade"),
            location_score=r.get("location_score"),
            zoning_upside_score=r.get("zoning_upside_score"),
            value_dislocation_score=r.get("value_dislocation_score"),
            distress_signal_score=r.get("distress_signal_score"),
            environmental_risk_score=r.get("environmental_risk_score"),
            market_velocity_score=r.get("market_velocity_score"),
            utility_readiness_score=r.get("utility_readiness_score"),
            bonus_points=r.get("bonus_points"),
            risk_flags=r.get("risk_flags") or [],
            upside_flags=r.get("upside_flags") or [],
            in_opportunity_zone=bool(r.get("in_opportunity_zone")),
            in_cra=bool(r.get("in_cra")),
            assemblage_potential=bool(r.get("assemblage_potential")),
            ai_summary=r.get("ai_summary"),
            scored_at=r.get("scored_at"),
        ),
        latest_underwriting=latest_uw,
        watchlist_status=r.get("watchlist_status"),
        soft_flags=soft_flags,
    )


@router.get("/{listing_id}/score", response_model=OpportunityScoreDetail)
async def get_deal_score(
    listing_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> OpportunityScoreDetail:
    """Full opportunity score detail including improvement levers."""
    row = await db.fetch_one(
        """
        SELECT os.*
        FROM opportunity_scores os
        JOIN listings l ON l.property_id = os.property_id
        WHERE l.id = :listing_id
        ORDER BY os.scored_at DESC
        LIMIT 1
        """,
        values={"listing_id": str(listing_id)},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Score not found for this listing")

    r = dict(row)
    score_inputs = r.get("score_inputs") or {}
    score_weights = r.get("score_weights") or {}

    return OpportunityScoreDetail(
        property_id=r["property_id"],
        overall_score=r.get("overall_score") or 0.0,
        score_grade=r.get("score_grade") or "F",
        location_score=r.get("location_score"),
        zoning_upside_score=r.get("zoning_upside_score"),
        value_dislocation_score=r.get("value_dislocation_score"),
        distress_signal_score=r.get("distress_signal_score"),
        environmental_risk_score=r.get("environmental_risk_score"),
        market_velocity_score=r.get("market_velocity_score"),
        utility_readiness_score=r.get("utility_readiness_score"),
        bonus_points=r.get("bonus_points"),
        score_weights=score_weights,
        score_inputs=score_inputs,
        risk_flags=r.get("risk_flags") or [],
        upside_flags=r.get("upside_flags") or [],
        in_opportunity_zone=bool(r.get("in_opportunity_zone")),
        in_cra=bool(r.get("in_cra")),
        assemblage_potential=bool(r.get("assemblage_potential")),
        ai_summary=r.get("ai_summary"),
        ai_risk_analysis=r.get("ai_risk_analysis"),
        ai_upside_analysis=r.get("ai_upside_analysis"),
        scored_at=r["scored_at"],
        scoring_version=r.get("scoring_version"),
        improvement_levers=_build_improvement_levers(score_inputs, score_weights),
    )


@router.get("/{listing_id}/underwriting", response_model=UnderwritingSnapshotModel)
async def get_latest_underwriting(
    listing_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> UnderwritingSnapshotModel:
    """Latest saved underwriting snapshot for a listing."""
    row = await db.fetch_one(
        """
        SELECT * FROM underwriting_snapshots
        WHERE listing_id = :listing_id
        ORDER BY created_at DESC
        LIMIT 1
        """,
        values={"listing_id": str(listing_id)},
    )
    if not row:
        raise HTTPException(status_code=404, detail="No underwriting snapshot found")
    return UnderwritingSnapshotModel(**dict(row))


@router.get("/{listing_id}/history", response_model=List[ScoreHistoryPoint])
async def get_score_history(
    listing_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> List[ScoreHistoryPoint]:
    """Historical score series for charting."""
    rows = await db.fetch_all(
        """
        SELECT sh.scored_at, sh.overall_score, sh.score_grade
        FROM score_history sh
        JOIN listings l ON l.property_id = sh.property_id
        WHERE l.id = :listing_id
        ORDER BY sh.scored_at ASC
        """,
        values={"listing_id": str(listing_id)},
    )
    return [
        ScoreHistoryPoint(
            scored_at=r["scored_at"],
            overall_score=r["overall_score"],
            score_grade=r["score_grade"],
        )
        for r in rows
    ]
