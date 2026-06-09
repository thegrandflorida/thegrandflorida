"""
Underwriting engine — complete 10-metric multifamily development proforma.

All formulas follow the FMDF PRD §Underwriting Model exactly.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class UnderwritingAssumptions:
    """Resolved underwriting assumptions — no Nones, all defaults filled."""
    units_allowed: int
    avg_market_rent: float          # monthly rent per unit
    hard_cost_per_unit: float
    soft_cost_pct: float
    financing_cost_pct: float
    vacancy_rate: float
    expense_ratio: float
    exit_cap_rate: float
    contingency_pct: float
    product_type: str = "garden"


def calculate_underwriting(
    listing_price: float,
    annual_taxes: float,
    gross_acreage: float,
    net_buildable_acreage: float,
    assumptions: UnderwritingAssumptions,
) -> dict[str, Any]:
    """
    Run the full 10-metric underwriting model.

    Returns a flat dict with every computed metric ready for DB insertion
    or direct API response serialization.

    Metrics:
    1.  price_per_acre
    2.  land_cost_per_buildable_unit
    3.  hard_cost_total
    4.  soft_cost_total
    5.  contingency
    6.  financing_cost
    7.  total_development_cost
    8.  gross_potential_rent
    9.  effective_gross_income
    10. operating_expenses
    11. noi
    12. stabilized_value
    13. developer_profit
    14. developer_profit_margin
    15. return_on_cost
    16. roc_vs_cap_spread  (bonus metric)
    """
    # Guard
    units = assumptions.units_allowed
    if units <= 0:
        raise ValueError("units_allowed must be > 0")
    if assumptions.exit_cap_rate <= 0:
        raise ValueError("exit_cap_rate must be > 0")

    # ------------------------------------------------------------------
    # 1. Price per acre
    # ------------------------------------------------------------------
    price_per_acre: float = listing_price / gross_acreage if gross_acreage > 0 else 0.0

    # ------------------------------------------------------------------
    # 2. Land cost per buildable unit
    # ------------------------------------------------------------------
    land_cost_per_buildable_unit: float = listing_price / units

    # ------------------------------------------------------------------
    # 3. Hard cost total
    # ------------------------------------------------------------------
    hard_cost_total: float = units * assumptions.hard_cost_per_unit

    # ------------------------------------------------------------------
    # 4. Soft cost total  (% of hard costs only, per PRD)
    # ------------------------------------------------------------------
    soft_cost_total: float = hard_cost_total * assumptions.soft_cost_pct

    # ------------------------------------------------------------------
    # 5. Contingency  (% of land + hard + soft)
    # ------------------------------------------------------------------
    pre_contingency_basis: float = listing_price + hard_cost_total + soft_cost_total
    contingency: float = pre_contingency_basis * assumptions.contingency_pct

    # ------------------------------------------------------------------
    # 6. Financing cost  (% of land + hard + soft, before contingency)
    # ------------------------------------------------------------------
    financing_cost: float = pre_contingency_basis * assumptions.financing_cost_pct

    # ------------------------------------------------------------------
    # 7. Total development cost
    # ------------------------------------------------------------------
    total_development_cost: float = (
        listing_price
        + hard_cost_total
        + soft_cost_total
        + contingency
        + financing_cost
    )

    # ------------------------------------------------------------------
    # 8. Gross potential rent  (annualized)
    # ------------------------------------------------------------------
    gross_potential_rent: float = units * assumptions.avg_market_rent * 12

    # ------------------------------------------------------------------
    # 9. Effective gross income
    # ------------------------------------------------------------------
    effective_gross_income: float = gross_potential_rent * (1 - assumptions.vacancy_rate)

    # ------------------------------------------------------------------
    # 10. Operating expenses
    # ------------------------------------------------------------------
    operating_expenses: float = effective_gross_income * assumptions.expense_ratio

    # ------------------------------------------------------------------
    # 11. NOI
    # ------------------------------------------------------------------
    noi: float = effective_gross_income - operating_expenses

    # ------------------------------------------------------------------
    # 12. Stabilized value  (direct cap)
    # ------------------------------------------------------------------
    stabilized_value: float = noi / assumptions.exit_cap_rate

    # ------------------------------------------------------------------
    # 13. Developer profit
    # ------------------------------------------------------------------
    developer_profit: float = stabilized_value - total_development_cost

    # ------------------------------------------------------------------
    # 14. Developer profit margin  (% of stabilized value)
    # ------------------------------------------------------------------
    developer_profit_margin: float = (
        developer_profit / stabilized_value if stabilized_value != 0 else 0.0
    )

    # ------------------------------------------------------------------
    # 15. Return on cost
    # ------------------------------------------------------------------
    return_on_cost: float = (
        noi / total_development_cost if total_development_cost != 0 else 0.0
    )

    # ------------------------------------------------------------------
    # 16. ROC vs cap rate spread
    # ------------------------------------------------------------------
    roc_vs_cap_spread: float = return_on_cost - assumptions.exit_cap_rate

    return {
        # Inputs echoed
        "listing_price": _r(listing_price),
        "gross_acreage": _r(gross_acreage),
        "net_buildable_acreage": _r(net_buildable_acreage),
        "units_allowed": units,
        "avg_market_rent": _r(assumptions.avg_market_rent),
        "hard_cost_per_unit": _r(assumptions.hard_cost_per_unit),
        # Assumptions
        "soft_cost_pct": assumptions.soft_cost_pct,
        "financing_cost_pct": assumptions.financing_cost_pct,
        "vacancy_rate": assumptions.vacancy_rate,
        "expense_ratio": assumptions.expense_ratio,
        "exit_cap_rate": assumptions.exit_cap_rate,
        "contingency_pct": assumptions.contingency_pct,
        # Computed metrics
        "price_per_acre": _r(price_per_acre),
        "land_cost_per_buildable_unit": _r(land_cost_per_buildable_unit),
        "hard_cost_total": _r(hard_cost_total),
        "soft_cost_total": _r(soft_cost_total),
        "contingency": _r(contingency),
        "financing_cost": _r(financing_cost),
        "total_development_cost": _r(total_development_cost),
        "gross_potential_rent": _r(gross_potential_rent),
        "effective_gross_income": _r(effective_gross_income),
        "operating_expenses": _r(operating_expenses),
        "noi": _r(noi),
        "stabilized_value": _r(stabilized_value),
        "developer_profit": _r(developer_profit),
        "developer_profit_margin": round(developer_profit_margin, 6),
        "return_on_cost": round(return_on_cost, 6),
        "roc_vs_cap_spread": round(roc_vs_cap_spread, 6),
    }


def _r(value: float, decimals: int = 2) -> float:
    """Round to the given number of decimal places."""
    return round(value, decimals)
