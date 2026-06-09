"""
Underwriting assumptions — defaults and resolver.
"""
from __future__ import annotations

from typing import Any, Optional

# ---------------------------------------------------------------------------
# Global default assumptions (PRD §Underwriting Model)
# ---------------------------------------------------------------------------

DEFAULT_ASSUMPTIONS: dict[str, Any] = {
    # Construction cost per unit
    "hard_cost_per_unit_garden": 145_000.0,   # Garden-style (3-story walk-up)
    "hard_cost_per_unit_podium": 210_000.0,   # Podium / structured parking
    # Soft costs as % of hard costs
    "soft_cost_pct": 0.18,
    # Construction financing as % of (land + hard + soft)
    "financing_cost_pct": 0.08,
    # Stabilized operations
    "vacancy_rate": 0.07,
    "expense_ratio": 0.38,
    "exit_cap_rate": 0.055,
    # Contingency as % of (land + hard + soft)
    "contingency_pct": 0.05,
    # Default product type
    "product_type": "garden",
}


def resolve_assumptions(
    overrides,
    county_rent_data: dict | None = None,
) -> dict[str, Any]:
    """
    Merge overrides onto global defaults.

    - `overrides` is either a UnderwritingOverrides Pydantic model or a plain dict.
    - `county_rent_data` should have keys rent_1br, rent_2br, rent_3br (all float|None).
    - avg_market_rent is derived from rent_data as (1BR * 0.4 + 2BR * 0.6) if not overridden.

    Returns a flat dict of resolved assumptions ready to pass to the engine.
    """
    # Handle both Pydantic models and plain dicts
    if hasattr(overrides, "model_dump"):
        overrides_dict: dict[str, Any] = {
            k: v for k, v in overrides.model_dump().items() if v is not None
        }
    else:
        overrides_dict = {k: v for k, v in (overrides or {}).items() if v is not None}

    # Determine hard cost per unit from product type
    product_type = overrides_dict.get("product_type") or DEFAULT_ASSUMPTIONS["product_type"]
    if product_type == "podium":
        default_hard_cost = DEFAULT_ASSUMPTIONS["hard_cost_per_unit_podium"]
    else:
        default_hard_cost = DEFAULT_ASSUMPTIONS["hard_cost_per_unit_garden"]

    resolved: dict[str, Any] = {
        "hard_cost_per_unit": overrides_dict.get("hard_cost_per_unit", default_hard_cost),
        "soft_cost_pct": overrides_dict.get("soft_cost_pct", DEFAULT_ASSUMPTIONS["soft_cost_pct"]),
        "financing_cost_pct": overrides_dict.get(
            "financing_cost_pct", DEFAULT_ASSUMPTIONS["financing_cost_pct"]
        ),
        "vacancy_rate": overrides_dict.get("vacancy_rate", DEFAULT_ASSUMPTIONS["vacancy_rate"]),
        "expense_ratio": overrides_dict.get("expense_ratio", DEFAULT_ASSUMPTIONS["expense_ratio"]),
        "exit_cap_rate": overrides_dict.get("exit_cap_rate", DEFAULT_ASSUMPTIONS["exit_cap_rate"]),
        "contingency_pct": overrides_dict.get(
            "contingency_pct", DEFAULT_ASSUMPTIONS["contingency_pct"]
        ),
        "product_type": product_type,
    }

    # avg_market_rent — use override or compute from rent_data blend
    if "avg_market_rent" in overrides_dict:
        resolved["avg_market_rent"] = overrides_dict["avg_market_rent"]
    elif county_rent_data:
        rent_1br = county_rent_data.get("rent_1br") or 0.0
        rent_2br = county_rent_data.get("rent_2br") or 0.0
        if rent_1br and rent_2br:
            resolved["avg_market_rent"] = rent_1br * 0.4 + rent_2br * 0.6
        elif rent_2br:
            resolved["avg_market_rent"] = rent_2br
        elif rent_1br:
            resolved["avg_market_rent"] = rent_1br
        else:
            resolved["avg_market_rent"] = 1_600.0  # conservative Florida floor
    else:
        resolved["avg_market_rent"] = 1_600.0

    return resolved
