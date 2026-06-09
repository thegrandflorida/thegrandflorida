"""
Market router — county and ZIP market data.
Prefix: /market   Tags: market
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field

from ..dependencies import get_current_user, get_db, get_redis
from ..services.cache import cache_key, get_cached, set_cached

router = APIRouter(prefix="/market", tags=["market"])

# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class RentSnapshot(BaseModel):
    period_end: Optional[str] = None
    rent_studio: Optional[float] = None
    rent_1br: Optional[float] = None
    rent_2br: Optional[float] = None
    rent_3br: Optional[float] = None
    median_rent: Optional[float] = None
    yoy_change_pct: Optional[float] = None
    source: Optional[str] = None


class DemographicSnapshot(BaseModel):
    population: Optional[int] = None
    population_growth_5yr_pct: Optional[float] = None
    median_household_income: Optional[float] = None
    income_growth_5yr_pct: Optional[float] = None
    median_age: Optional[float] = None
    households: Optional[int] = None
    renter_pct: Optional[float] = None
    updated_at: Optional[str] = None


class EmploymentSnapshot(BaseModel):
    unemployment_rate: Optional[float] = None
    job_growth_12mo_pct: Optional[float] = None
    top_employers: List[str] = Field(default_factory=list)
    major_industries: List[str] = Field(default_factory=list)
    updated_at: Optional[str] = None


class SupplyDataPoint(BaseModel):
    period_end: Optional[str] = None
    units_permitted: Optional[int] = None
    units_under_construction: Optional[int] = None
    units_delivered: Optional[int] = None
    absorption_rate: Optional[float] = None
    vacancy_rate: Optional[float] = None


class CountySummary(BaseModel):
    county_id: int
    name: str
    fips_code: Optional[str] = None
    latest_rent: Optional[RentSnapshot] = None
    demographics: Optional[DemographicSnapshot] = None
    employment: Optional[EmploymentSnapshot] = None
    latest_supply: Optional[SupplyDataPoint] = None


class CountyMarketSnapshot(BaseModel):
    county_id: int
    name: str
    fips_code: Optional[str] = None
    rent_history: List[RentSnapshot] = Field(default_factory=list)
    demographics: Optional[DemographicSnapshot] = None
    employment: Optional[EmploymentSnapshot] = None
    supply_pipeline: List[SupplyDataPoint] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_rent(r: dict) -> RentSnapshot:
    return RentSnapshot(
        period_end=str(r.get("period_end")) if r.get("period_end") else None,
        rent_studio=r.get("rent_studio"),
        rent_1br=r.get("rent_1br"),
        rent_2br=r.get("rent_2br"),
        rent_3br=r.get("rent_3br"),
        median_rent=r.get("median_rent"),
        yoy_change_pct=r.get("yoy_change_pct"),
        source=r.get("source"),
    )


def _row_to_supply(r: dict) -> SupplyDataPoint:
    return SupplyDataPoint(
        period_end=str(r.get("period_end")) if r.get("period_end") else None,
        units_permitted=r.get("units_permitted"),
        units_under_construction=r.get("units_under_construction"),
        units_delivered=r.get("units_delivered"),
        absorption_rate=r.get("absorption_rate"),
        vacancy_rate=r.get("vacancy_rate"),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/counties", response_model=List[CountySummary])
async def list_counties(
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> List[CountySummary]:
    """All 4 primary counties with latest rent, demographics, employment, supply. Cached 1 hour."""
    ck = cache_key("market", "counties")
    cached = await get_cached(redis, ck)
    if cached is not None:
        return [CountySummary(**item) for item in cached]

    county_rows = await db.fetch_all(
        """
        SELECT id, name, fips_code FROM counties
        WHERE state = 'FL'
        ORDER BY name
        """
    )

    results: list[CountySummary] = []
    for crow in county_rows:
        c = dict(crow)
        cid = c["id"]

        # Latest rent
        rent_row = await db.fetch_one(
            """
            SELECT * FROM rent_data
            WHERE county_id = :cid AND data_source_type = 'county'
            ORDER BY period_end DESC LIMIT 1
            """,
            values={"cid": cid},
        )

        # Demographics
        demo_row = await db.fetch_one(
            "SELECT * FROM demographic_data WHERE county_id = :cid ORDER BY updated_at DESC LIMIT 1",
            values={"cid": cid},
        )

        # Employment
        emp_row = await db.fetch_one(
            "SELECT * FROM employment_data WHERE county_id = :cid ORDER BY updated_at DESC LIMIT 1",
            values={"cid": cid},
        )

        # Supply
        supply_row = await db.fetch_one(
            "SELECT * FROM supply_pipeline WHERE county_id = :cid ORDER BY period_end DESC LIMIT 1",
            values={"cid": cid},
        )

        results.append(
            CountySummary(
                county_id=cid,
                name=c["name"],
                fips_code=c.get("fips_code"),
                latest_rent=_row_to_rent(dict(rent_row)) if rent_row else None,
                demographics=DemographicSnapshot(**dict(demo_row)) if demo_row else None,
                employment=EmploymentSnapshot(**dict(emp_row)) if emp_row else None,
                latest_supply=_row_to_supply(dict(supply_row)) if supply_row else None,
            )
        )

    await set_cached(redis, ck, [r.model_dump(mode="json") for r in results], ttl_seconds=3600)
    return results


@router.get("/county/{county_id}", response_model=CountyMarketSnapshot)
async def get_county(
    county_id: int = Path(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> CountyMarketSnapshot:
    """Full county market snapshot."""
    county_row = await db.fetch_one(
        "SELECT * FROM counties WHERE id = :cid",
        values={"cid": county_id},
    )
    if not county_row:
        raise HTTPException(status_code=404, detail="County not found")
    c = dict(county_row)

    rent_rows = await db.fetch_all(
        """
        SELECT * FROM rent_data
        WHERE county_id = :cid AND data_source_type = 'county'
        ORDER BY period_end DESC LIMIT 12
        """,
        values={"cid": county_id},
    )

    demo_row = await db.fetch_one(
        "SELECT * FROM demographic_data WHERE county_id = :cid ORDER BY updated_at DESC LIMIT 1",
        values={"cid": county_id},
    )

    emp_row = await db.fetch_one(
        "SELECT * FROM employment_data WHERE county_id = :cid ORDER BY updated_at DESC LIMIT 1",
        values={"cid": county_id},
    )

    supply_rows = await db.fetch_all(
        "SELECT * FROM supply_pipeline WHERE county_id = :cid ORDER BY period_end DESC LIMIT 12",
        values={"cid": county_id},
    )

    return CountyMarketSnapshot(
        county_id=county_id,
        name=c["name"],
        fips_code=c.get("fips_code"),
        rent_history=[_row_to_rent(dict(r)) for r in rent_rows],
        demographics=DemographicSnapshot(**dict(demo_row)) if demo_row else None,
        employment=EmploymentSnapshot(**dict(emp_row)) if emp_row else None,
        supply_pipeline=[_row_to_supply(dict(r)) for r in supply_rows],
    )


@router.get("/county/{county_id}/rents", response_model=List[RentSnapshot])
async def get_county_rents(
    county_id: int = Path(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> List[RentSnapshot]:
    """Last 12 months of rent data for a county."""
    rows = await db.fetch_all(
        """
        SELECT * FROM rent_data
        WHERE county_id = :cid AND data_source_type = 'county'
        ORDER BY period_end DESC LIMIT 12
        """,
        values={"cid": county_id},
    )
    return [_row_to_rent(dict(r)) for r in rows]


@router.get("/county/{county_id}/supply", response_model=List[SupplyDataPoint])
async def get_county_supply(
    county_id: int = Path(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> List[SupplyDataPoint]:
    """Supply pipeline data for a county (12 months)."""
    rows = await db.fetch_all(
        "SELECT * FROM supply_pipeline WHERE county_id = :cid ORDER BY period_end DESC LIMIT 12",
        values={"cid": county_id},
    )
    return [_row_to_supply(dict(r)) for r in rows]


@router.get("/county/{county_id}/demographics")
async def get_county_demographics(
    county_id: int = Path(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> dict:
    """Latest demographic and employment data for a county."""
    demo_row = await db.fetch_one(
        "SELECT * FROM demographic_data WHERE county_id = :cid ORDER BY updated_at DESC LIMIT 1",
        values={"cid": county_id},
    )
    emp_row = await db.fetch_one(
        "SELECT * FROM employment_data WHERE county_id = :cid ORDER BY updated_at DESC LIMIT 1",
        values={"cid": county_id},
    )

    return {
        "demographics": dict(demo_row) if demo_row else None,
        "employment": dict(emp_row) if emp_row else None,
    }


@router.get("/zip/{zip_code}/rents", response_model=List[RentSnapshot])
async def get_zip_rents(
    zip_code: str = Path(..., min_length=5, max_length=5, pattern=r"^\d{5}$"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> List[RentSnapshot]:
    """Last 6 months of rent data by ZIP code."""
    rows = await db.fetch_all(
        """
        SELECT * FROM rent_data
        WHERE zip_code = :zip_code AND data_source_type = 'zip'
        ORDER BY period_end DESC LIMIT 6
        """,
        values={"zip_code": zip_code},
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"No rent data found for ZIP {zip_code}")
    return [_row_to_rent(dict(r)) for r in rows]
