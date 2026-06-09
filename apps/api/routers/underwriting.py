"""
Underwriting router — calculate, save, list snapshots, default assumptions.
Prefix: /underwriting   Tags: underwriting
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..dependencies import get_current_user, get_db
from ..services.underwriting.assumptions import resolve_assumptions
from ..services.underwriting.engine import calculate_underwriting, UnderwritingAssumptions

router = APIRouter(prefix="/underwriting", tags=["underwriting"])

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class UnderwritingOverrides(BaseModel):
    """All fields optional — missing fields fall back to defaults."""
    units_allowed: Optional[int] = None
    net_buildable_acreage: Optional[float] = None
    avg_market_rent: Optional[float] = None
    hard_cost_per_unit: Optional[float] = None
    soft_cost_pct: Optional[float] = None
    financing_cost_pct: Optional[float] = None
    vacancy_rate: Optional[float] = None
    expense_ratio: Optional[float] = None
    exit_cap_rate: Optional[float] = None
    contingency_pct: Optional[float] = None
    product_type: Optional[str] = Field(default=None, description="garden | podium")


class UnderwritingInput(BaseModel):
    listing_id: UUID
    overrides: UnderwritingOverrides = Field(default_factory=UnderwritingOverrides)


class UnderwritingSnapshotOut(BaseModel):
    id: Optional[UUID] = None
    listing_id: UUID
    listing_price: float
    gross_acreage: Optional[float] = None
    net_buildable_acreage: Optional[float] = None
    units_allowed: Optional[int] = None
    avg_market_rent: Optional[float] = None
    # Cost stack
    price_per_acre: Optional[float] = None
    land_cost_per_buildable_unit: Optional[float] = None
    hard_cost_per_unit: float
    hard_cost_total: float
    soft_cost_pct: float
    soft_cost_total: float
    contingency_pct: float
    contingency: float
    financing_cost_pct: float
    financing_cost: float
    total_development_cost: float
    # Revenue
    gross_potential_rent: float
    effective_gross_income: float
    vacancy_rate: float
    expense_ratio: float
    operating_expenses: float
    noi: float
    exit_cap_rate: float
    stabilized_value: float
    # Returns
    developer_profit: float
    developer_profit_margin: float
    return_on_cost: float
    roc_vs_cap_spread: float
    # Metadata
    user_override_flags: Dict[str, bool] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    assumptions_used: Dict[str, Any] = Field(default_factory=dict)


class UnderwritingDefaults(BaseModel):
    hard_cost_per_unit_garden: float
    hard_cost_per_unit_podium: float
    soft_cost_pct: float
    financing_cost_pct: float
    vacancy_rate: float
    expense_ratio: float
    exit_cap_rate: float
    contingency_pct: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _fetch_listing_data(listing_id: UUID, db) -> dict[str, Any]:
    """Pull listing price, acreage, tax record, rent data from DB."""
    row = await db.fetch_one(
        """
        SELECT
            l.list_price,
            p.lot_size_acres         AS gross_acreage,
            p.county_id,
            pd.annual_taxes,
            z.max_density_units_per_acre,
            rd.rent_1br,
            rd.rent_2br,
            rd.rent_3br
        FROM listings          l
        JOIN properties        p  ON p.id          = l.property_id
        LEFT JOIN parcel_data  pd ON pd.property_id = p.id
        LEFT JOIN zoning        z  ON z.property_id  = p.id
        LEFT JOIN (
            SELECT DISTINCT ON (county_id)
                county_id, rent_1br, rent_2br, rent_3br
            FROM rent_data
            WHERE data_source_type = 'county'
            ORDER BY county_id, period_end DESC
        ) rd ON rd.county_id = p.county_id
        WHERE l.id = :listing_id
        """,
        values={"listing_id": str(listing_id)},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")
    return dict(row)


def _build_override_flags(overrides: UnderwritingOverrides) -> dict[str, bool]:
    flags: dict[str, bool] = {}
    for field_name, value in overrides.model_dump().items():
        if value is not None:
            flags[field_name] = True
    return flags


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/calculate", response_model=UnderwritingSnapshotOut)
async def calculate(
    body: UnderwritingInput,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> UnderwritingSnapshotOut:
    """Run the full 10-metric underwriting model. Does NOT persist."""
    listing_data = await _fetch_listing_data(body.listing_id, db)
    listing_price = listing_data.get("list_price")
    if not listing_price:
        raise HTTPException(status_code=422, detail="Listing has no list price — cannot underwrite")

    rent_data = {
        "rent_1br": listing_data.get("rent_1br"),
        "rent_2br": listing_data.get("rent_2br"),
        "rent_3br": listing_data.get("rent_3br"),
    }

    assumptions_dict = resolve_assumptions(body.overrides, rent_data)

    # Derive units_allowed if not overridden
    if body.overrides.units_allowed is not None:
        assumptions_dict["units_allowed"] = body.overrides.units_allowed
    else:
        gross_acreage = listing_data.get("gross_acreage") or 1.0
        net_buildable = body.overrides.net_buildable_acreage or (gross_acreage * 0.75)
        max_density = listing_data.get("max_density_units_per_acre") or 16.0
        assumptions_dict["units_allowed"] = max(1, int(net_buildable * max_density))

    gross_acreage = listing_data.get("gross_acreage") or 1.0
    net_buildable = body.overrides.net_buildable_acreage or (gross_acreage * 0.75)
    annual_taxes = listing_data.get("annual_taxes") or 0.0

    uw_assumptions = UnderwritingAssumptions(**assumptions_dict)
    snapshot = calculate_underwriting(
        listing_price=listing_price,
        annual_taxes=annual_taxes,
        gross_acreage=gross_acreage,
        net_buildable_acreage=net_buildable,
        assumptions=uw_assumptions,
    )

    return UnderwritingSnapshotOut(
        listing_id=body.listing_id,
        user_override_flags=_build_override_flags(body.overrides),
        assumptions_used=assumptions_dict,
        **snapshot,
    )


@router.post("/save", response_model=UnderwritingSnapshotOut)
async def save_underwriting(
    body: UnderwritingInput,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> UnderwritingSnapshotOut:
    """Calculate and persist to underwriting_snapshots."""
    listing_data = await _fetch_listing_data(body.listing_id, db)
    listing_price = listing_data.get("list_price")
    if not listing_price:
        raise HTTPException(status_code=422, detail="Listing has no list price — cannot underwrite")

    rent_data = {
        "rent_1br": listing_data.get("rent_1br"),
        "rent_2br": listing_data.get("rent_2br"),
        "rent_3br": listing_data.get("rent_3br"),
    }

    assumptions_dict = resolve_assumptions(body.overrides, rent_data)

    if body.overrides.units_allowed is not None:
        assumptions_dict["units_allowed"] = body.overrides.units_allowed
    else:
        gross_acreage = listing_data.get("gross_acreage") or 1.0
        net_buildable = body.overrides.net_buildable_acreage or (gross_acreage * 0.75)
        max_density = listing_data.get("max_density_units_per_acre") or 16.0
        assumptions_dict["units_allowed"] = max(1, int(net_buildable * max_density))

    gross_acreage = listing_data.get("gross_acreage") or 1.0
    net_buildable = body.overrides.net_buildable_acreage or (gross_acreage * 0.75)
    annual_taxes = listing_data.get("annual_taxes") or 0.0

    uw_assumptions = UnderwritingAssumptions(**assumptions_dict)
    snapshot = calculate_underwriting(
        listing_price=listing_price,
        annual_taxes=annual_taxes,
        gross_acreage=gross_acreage,
        net_buildable_acreage=net_buildable,
        assumptions=uw_assumptions,
    )

    override_flags = _build_override_flags(body.overrides)
    record_id = uuid4()
    now = datetime.utcnow()

    await db.execute(
        """
        INSERT INTO underwriting_snapshots (
            id, listing_id, created_by,
            listing_price, gross_acreage, net_buildable_acreage, units_allowed,
            avg_market_rent, price_per_acre, land_cost_per_buildable_unit,
            hard_cost_per_unit, hard_cost_total, soft_cost_pct, soft_cost_total,
            contingency_pct, contingency, financing_cost_pct, financing_cost,
            total_development_cost, gross_potential_rent, effective_gross_income,
            vacancy_rate, expense_ratio, operating_expenses, noi, exit_cap_rate,
            stabilized_value, developer_profit, developer_profit_margin,
            return_on_cost, roc_vs_cap_spread, user_override_flags, created_at
        ) VALUES (
            :id, :listing_id, :created_by,
            :listing_price, :gross_acreage, :net_buildable_acreage, :units_allowed,
            :avg_market_rent, :price_per_acre, :land_cost_per_buildable_unit,
            :hard_cost_per_unit, :hard_cost_total, :soft_cost_pct, :soft_cost_total,
            :contingency_pct, :contingency, :financing_cost_pct, :financing_cost,
            :total_development_cost, :gross_potential_rent, :effective_gross_income,
            :vacancy_rate, :expense_ratio, :operating_expenses, :noi, :exit_cap_rate,
            :stabilized_value, :developer_profit, :developer_profit_margin,
            :return_on_cost, :roc_vs_cap_spread, :user_override_flags, :created_at
        )
        """,
        values={
            "id": str(record_id),
            "listing_id": str(body.listing_id),
            "created_by": current_user["id"],
            "created_at": now,
            "user_override_flags": override_flags,
            **snapshot,
        },
    )

    return UnderwritingSnapshotOut(
        id=record_id,
        listing_id=body.listing_id,
        user_override_flags=override_flags,
        assumptions_used=assumptions_dict,
        created_at=now,
        **snapshot,
    )


@router.get("/{listing_id}/snapshots", response_model=List[UnderwritingSnapshotOut])
async def list_snapshots(
    listing_id: UUID,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> List[UnderwritingSnapshotOut]:
    """All saved underwriting snapshots for a listing, newest first."""
    rows = await db.fetch_all(
        """
        SELECT * FROM underwriting_snapshots
        WHERE listing_id = :listing_id
        ORDER BY created_at DESC
        """,
        values={"listing_id": str(listing_id)},
    )
    return [UnderwritingSnapshotOut(**dict(r)) for r in rows]


@router.get("/assumptions/defaults", response_model=UnderwritingDefaults)
async def get_defaults(
    current_user: dict = Depends(get_current_user),
) -> UnderwritingDefaults:
    """Global default underwriting assumptions."""
    from ..services.underwriting.assumptions import DEFAULT_ASSUMPTIONS
    return UnderwritingDefaults(
        hard_cost_per_unit_garden=DEFAULT_ASSUMPTIONS["hard_cost_per_unit_garden"],
        hard_cost_per_unit_podium=DEFAULT_ASSUMPTIONS["hard_cost_per_unit_podium"],
        soft_cost_pct=DEFAULT_ASSUMPTIONS["soft_cost_pct"],
        financing_cost_pct=DEFAULT_ASSUMPTIONS["financing_cost_pct"],
        vacancy_rate=DEFAULT_ASSUMPTIONS["vacancy_rate"],
        expense_ratio=DEFAULT_ASSUMPTIONS["expense_ratio"],
        exit_cap_rate=DEFAULT_ASSUMPTIONS["exit_cap_rate"],
        contingency_pct=DEFAULT_ASSUMPTIONS["contingency_pct"],
    )
