from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class UnderwritingAssumptions(BaseModel):
    """Optional overrides applied on top of system defaults."""

    units_allowed: Optional[int] = None
    construction_type: Optional[str] = None
    hard_cost_per_unit: Optional[float] = None
    soft_cost_pct: Optional[float] = None
    financing_cost_pct: Optional[float] = None
    contingency_pct: Optional[float] = None
    avg_market_rent: Optional[float] = None
    rent_source: Optional[str] = None
    vacancy_rate: Optional[float] = None
    expense_ratio: Optional[float] = None
    exit_cap_rate: Optional[float] = None


class UnderwritingDefaults(BaseModel):
    """System-default assumptions per PRD v1.0."""

    hard_cost_per_unit: float = 145_000.0
    soft_cost_pct: float = 0.18
    financing_cost_pct: float = 0.08
    vacancy_rate: float = 0.07
    expense_ratio: float = 0.38
    exit_cap_rate: float = 0.055
    contingency_pct: float = 0.05
    construction_type: str = "garden"
    rent_source: str = "CoStar"


class UnderwritingInput(BaseModel):
    listing_id: UUID
    overrides: UnderwritingAssumptions


class UnderwritingSnapshot(BaseModel):
    id: UUID
    listing_id: UUID
    property_id: UUID
    calculated_at: datetime

    # Snapshotted inputs
    snap_listing_price: float
    snap_annual_taxes: Optional[float] = None
    snap_gross_acreage: float
    snap_net_buildable_acreage: float
    snap_price_per_acre: float

    # Assumptions used
    assumed_units_allowed: int
    assumed_hard_cost_per_unit: float
    assumed_soft_cost_pct: float
    assumed_financing_cost_pct: float
    assumed_avg_market_rent: float
    assumed_vacancy_rate: float
    assumed_expense_ratio: float
    assumed_exit_cap_rate: float

    # Derived financials
    land_cost_per_buildable_unit: float
    total_development_cost: float
    gross_potential_rent_annual: float
    effective_gross_income_annual: float
    noi_annual: float
    stabilized_value: float
    developer_profit_absolute: float
    developer_profit_margin_pct: float
    return_on_cost: float
    roc_vs_cap_rate_spread: float

    # Meta
    user_override_flags: dict = {}
    is_system_generated: bool = True
