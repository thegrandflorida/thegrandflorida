from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ScoreLabel(str, Enum):
    EXCEPTIONAL = "Exceptional"
    STRONG = "Strong"
    SOLID = "Solid"
    MARGINAL = "Marginal"
    WEAK = "Weak"


class ScoreLabelThresholds:
    EXCEPTIONAL = 85.0
    STRONG = 70.0
    SOLID = 55.0
    MARGINAL = 40.0

    @classmethod
    def from_score(cls, score: float) -> ScoreLabel:
        if score >= cls.EXCEPTIONAL:
            return ScoreLabel.EXCEPTIONAL
        elif score >= cls.STRONG:
            return ScoreLabel.STRONG
        elif score >= cls.SOLID:
            return ScoreLabel.SOLID
        elif score >= cls.MARGINAL:
            return ScoreLabel.MARGINAL
        else:
            return ScoreLabel.WEAK


class SubIndicatorScore(BaseModel):
    raw_value: Optional[float] = None
    normalized_score: float
    points_contribution: float
    weight: float


class BonusModifier(BaseModel):
    name: str
    points: float
    reason: str


class ImprovementLever(BaseModel):
    indicator: str
    current_pts: float
    max_pts: float
    gap: float
    hint: str


class OpportunityScoreDetail(BaseModel):
    id: UUID
    listing_id: UUID
    calculated_at: datetime

    # Raw values for all 10 indicators
    raw_land_cost_per_unit: Optional[float] = None
    raw_rent_growth_pct: Optional[float] = None
    raw_population_growth_pct: Optional[float] = None
    raw_median_hh_income: Optional[float] = None
    raw_employment_growth_pct: Optional[float] = None
    raw_supply_pressure_ratio: Optional[float] = None
    raw_effective_tax_rate: Optional[float] = None
    raw_sfha_pct: Optional[float] = None
    raw_wetland_coverage_pct: Optional[float] = None
    raw_infrastructure_score: Optional[float] = None

    # Normalized scores (0–10 per indicator)
    norm_land_cost_per_unit: float
    norm_rent_growth: float
    norm_population_growth: float
    norm_median_hh_income: float
    norm_employment_growth: float
    norm_new_supply: float
    norm_property_tax_burden: float
    norm_flood_risk: float
    norm_wetland_risk: float
    norm_infrastructure_access: float

    # Weighted point contributions
    pts_land_cost_per_unit: float
    pts_rent_growth: float
    pts_population_growth: float
    pts_median_hh_income: float
    pts_employment_growth: float
    pts_new_supply: float
    pts_property_tax_burden: float
    pts_flood_risk: float
    pts_wetland_risk: float
    pts_infrastructure_access: float

    # Bonuses and composite
    bonus_modifiers: list[BonusModifier] = []
    bonus_points_total: float = 0.0
    base_composite_score: float
    final_score: float
    score_label: ScoreLabel
    improvement_levers: list[ImprovementLever] = []


class ScoreModelVersion(BaseModel):
    id: UUID
    version_number: str
    effective_date: date
    is_active: bool
    weights: dict[str, float]
    breakpoints: dict[str, list[dict]]
