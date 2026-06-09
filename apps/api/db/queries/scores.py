from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

import asyncpg

try:
    from db.connection import get_connection  # type: ignore[import]
except ImportError:
    from apps.api.db.connection import get_connection


async def upsert_opportunity_score(data: dict[str, Any]) -> UUID:
    """Insert or update the top-level opportunity score for a property."""
    query = """
        INSERT INTO public.opportunity_scores (
            property_id, overall_score, location_score, zoning_upside_score,
            value_dislocation_score, distress_signal_score, environmental_risk_score,
            market_velocity_score, utility_readiness_score, bonus_points,
            score_weights, score_inputs, risk_flags, upside_flags,
            in_opportunity_zone, in_cra, assemblage_potential,
            scoring_config_id, scoring_version
        ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10,
            $11, $12, $13, $14,
            $15, $16, $17,
            $18, $19
        )
        ON CONFLICT (property_id) DO UPDATE SET
            overall_score            = EXCLUDED.overall_score,
            location_score           = EXCLUDED.location_score,
            zoning_upside_score      = EXCLUDED.zoning_upside_score,
            value_dislocation_score  = EXCLUDED.value_dislocation_score,
            distress_signal_score    = EXCLUDED.distress_signal_score,
            environmental_risk_score = EXCLUDED.environmental_risk_score,
            market_velocity_score    = EXCLUDED.market_velocity_score,
            utility_readiness_score  = EXCLUDED.utility_readiness_score,
            bonus_points             = EXCLUDED.bonus_points,
            score_weights            = EXCLUDED.score_weights,
            score_inputs             = EXCLUDED.score_inputs,
            risk_flags               = EXCLUDED.risk_flags,
            upside_flags             = EXCLUDED.upside_flags,
            in_opportunity_zone      = EXCLUDED.in_opportunity_zone,
            in_cra                   = EXCLUDED.in_cra,
            assemblage_potential     = EXCLUDED.assemblage_potential,
            scoring_config_id        = EXCLUDED.scoring_config_id,
            scoring_version          = EXCLUDED.scoring_version,
            scored_at                = NOW()
        RETURNING id
    """
    import json

    async with get_connection() as conn:
        row = await conn.fetchrow(
            query,
            data.get("property_id"),
            data.get("overall_score"),
            data.get("location_score"),
            data.get("zoning_upside_score"),
            data.get("value_dislocation_score"),
            data.get("distress_signal_score"),
            data.get("environmental_risk_score"),
            data.get("market_velocity_score"),
            data.get("utility_readiness_score"),
            data.get("bonus_points"),
            json.dumps(data.get("score_weights", {})),
            json.dumps(data.get("score_inputs", {})),
            data.get("risk_flags", []),
            data.get("upside_flags", []),
            data.get("in_opportunity_zone", False),
            data.get("in_cra", False),
            data.get("assemblage_potential", False),
            data.get("scoring_config_id"),
            data.get("scoring_version"),
        )
        return row["id"]


async def upsert_score_detail(data: dict[str, Any]) -> UUID:
    """Insert a new opportunity_score_details row. Returns the detail UUID."""
    import json

    query = """
        INSERT INTO public.opportunity_score_details (
            property_id, listing_id, underwriting_id, score_model_version_id,
            raw_land_cost_per_unit, raw_rent_growth_pct, raw_population_growth_pct,
            raw_median_hh_income, raw_employment_growth_pct, raw_supply_pressure_ratio,
            raw_effective_tax_rate, raw_sfha_pct, raw_wetland_coverage_pct,
            raw_infra_water_dist_ft, raw_infra_sewer_dist_ft, raw_infra_road_type,
            raw_infra_transit_dist_ft,
            norm_land_cost_per_unit, norm_rent_growth, norm_population_growth,
            norm_median_hh_income, norm_employment_growth, norm_new_supply,
            norm_property_tax_burden, norm_flood_risk, norm_wetland_risk,
            norm_infrastructure_access,
            pts_land_cost_per_unit, pts_rent_growth, pts_population_growth,
            pts_median_hh_income, pts_employment_growth, pts_new_supply,
            pts_property_tax_burden, pts_flood_risk, pts_wetland_risk,
            pts_infrastructure_access,
            bonus_modifiers, bonus_points_total,
            base_composite_score, final_score, score_label,
            improvement_levers
        ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
            $28, $29, $30, $31, $32, $33, $34, $35, $36, $37,
            $38::jsonb, $39,
            $40, $41, $42,
            $43::jsonb
        )
        RETURNING id
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            query,
            data.get("property_id"),
            data.get("listing_id"),
            data.get("underwriting_id"),
            data.get("score_model_version_id"),
            data.get("raw_land_cost_per_unit"),
            data.get("raw_rent_growth_pct"),
            data.get("raw_population_growth_pct"),
            data.get("raw_median_hh_income"),
            data.get("raw_employment_growth_pct"),
            data.get("raw_supply_pressure_ratio"),
            data.get("raw_effective_tax_rate"),
            data.get("raw_sfha_pct"),
            data.get("raw_wetland_coverage_pct"),
            data.get("raw_infra_water_dist_ft"),
            data.get("raw_infra_sewer_dist_ft"),
            data.get("raw_infra_road_type"),
            data.get("raw_infra_transit_dist_ft"),
            data.get("norm_land_cost_per_unit", 0),
            data.get("norm_rent_growth", 0),
            data.get("norm_population_growth", 0),
            data.get("norm_median_hh_income", 0),
            data.get("norm_employment_growth", 0),
            data.get("norm_new_supply", 0),
            data.get("norm_property_tax_burden", 0),
            data.get("norm_flood_risk", 0),
            data.get("norm_wetland_risk", 0),
            data.get("norm_infrastructure_access", 0),
            data.get("pts_land_cost_per_unit", 0),
            data.get("pts_rent_growth", 0),
            data.get("pts_population_growth", 0),
            data.get("pts_median_hh_income", 0),
            data.get("pts_employment_growth", 0),
            data.get("pts_new_supply", 0),
            data.get("pts_property_tax_burden", 0),
            data.get("pts_flood_risk", 0),
            data.get("pts_wetland_risk", 0),
            data.get("pts_infrastructure_access", 0),
            json.dumps(data.get("bonus_modifiers", [])),
            data.get("bonus_points_total", 0),
            data.get("base_composite_score"),
            data.get("final_score"),
            data.get("score_label"),
            json.dumps(data.get("improvement_levers", [])),
        )
        return row["id"]


async def get_score_detail(listing_id: UUID) -> Optional[asyncpg.Record]:
    """Return the most recent score detail row for a listing."""
    query = """
        SELECT * FROM public.opportunity_score_details
        WHERE listing_id = $1
        ORDER BY calculated_at DESC
        LIMIT 1
    """
    async with get_connection() as conn:
        return await conn.fetchrow(query, listing_id)


async def get_score_history(listing_id: UUID) -> list[asyncpg.Record]:
    """Return all score snapshots for a listing ordered by calculation date."""
    query = """
        SELECT id, listing_id, calculated_at, final_score, score_label,
               base_composite_score, bonus_points_total
        FROM public.opportunity_score_details
        WHERE listing_id = $1
        ORDER BY calculated_at DESC
    """
    async with get_connection() as conn:
        return await conn.fetch(query, listing_id)


async def get_active_score_model() -> Optional[asyncpg.Record]:
    """Return the currently active score model version row."""
    query = """
        SELECT * FROM public.score_model_versions
        WHERE is_active = TRUE
        ORDER BY effective_date DESC
        LIMIT 1
    """
    async with get_connection() as conn:
        return await conn.fetchrow(query)
