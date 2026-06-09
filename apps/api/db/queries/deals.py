from __future__ import annotations

import json
from datetime import date
from typing import Any, Optional
from uuid import UUID

import asyncpg

try:
    from db.connection import get_connection  # type: ignore[import]
except ImportError:
    from apps.api.db.connection import get_connection


async def get_daily_feed(
    feed_date: date,
    filters: dict[str, Any],
    page: int = 1,
    per_page: int = 25,
) -> list[asyncpg.Record]:
    """Return ranked deal feed rows for a given date with optional filters."""
    offset = (page - 1) * per_page

    where_clauses = ["dr.ranking_date = $1"]
    params: list[Any] = [feed_date]
    idx = 2

    if filters.get("county_ids"):
        where_clauses.append(f"p.county_id = ANY(${idx}::int[])")
        params.append(filters["county_ids"])
        idx += 1

    if filters.get("min_score") is not None:
        where_clauses.append(f"dr.score_at_ranking >= ${idx}")
        params.append(filters["min_score"])
        idx += 1

    if filters.get("score_labels"):
        where_clauses.append(f"dr.score_label = ANY(${idx}::text[])")
        params.append(filters["score_labels"])
        idx += 1

    if filters.get("min_acreage") is not None:
        where_clauses.append(f"dr.snap_acreage >= ${idx}")
        params.append(filters["min_acreage"])
        idx += 1

    if filters.get("max_price") is not None:
        where_clauses.append(f"dr.snap_listing_price <= ${idx}")
        params.append(filters["max_price"])
        idx += 1

    if filters.get("in_morning_digest") is True:
        where_clauses.append("dr.in_morning_digest = TRUE")

    where_sql = " AND ".join(where_clauses)

    params.extend([per_page, offset])
    limit_idx = idx
    offset_idx = idx + 1

    query = f"""
        SELECT
            dr.rank_position,
            dr.score_at_ranking        AS final_score,
            dr.score_label,
            dr.listing_id,
            dr.property_id,
            COALESCE(dr.snap_address, p.address_street || ', ' || p.address_city) AS address,
            c.name                     AS county_name,
            dr.snap_listing_price      AS listing_price,
            dr.snap_acreage            AS acreage,
            dr.snap_units_allowed      AS units_allowed,
            dr.snap_land_per_unit      AS land_cost_per_unit,
            dr.snap_roc                AS return_on_cost,
            l.days_on_market,
            dr.in_morning_digest,
            COALESCE(osd.bonus_modifiers, '[]'::jsonb) AS soft_flags_raw
        FROM public.daily_rankings dr
        JOIN public.listings l ON l.id = dr.listing_id
        JOIN public.properties p ON p.id = dr.property_id
        JOIN public.counties c ON c.id = p.county_id
        LEFT JOIN public.opportunity_score_details osd ON osd.listing_id = dr.listing_id
            AND osd.calculated_at = (
                SELECT MAX(calculated_at) FROM public.opportunity_score_details
                WHERE listing_id = dr.listing_id
            )
        WHERE {where_sql}
        ORDER BY dr.rank_position ASC
        LIMIT ${limit_idx} OFFSET ${offset_idx}
    """

    async with get_connection() as conn:
        return await conn.fetch(query, *params)


async def get_deal_card(listing_id: UUID) -> Optional[asyncpg.Record]:
    """Return full joined deal card data for a single listing."""
    query = """
        SELECT
            l.*,
            p.*,
            pd.*,
            z.zoning_code,
            z.zoning_description,
            z.max_density_units_per_acre,
            z.max_height_ft,
            z.allowable_uses,
            z.upzoning_potential,
            z.future_land_use,
            fz.fema_zone_code,
            fz.pct_parcel_in_flood_zone AS sfha_pct,
            fz.base_flood_elevation_ft,
            fz.is_special_flood_hazard,
            w.has_wetlands,
            w.wetland_pct,
            w.wetland_types,
            w.sfwmd_jurisdiction,
            w.mitigation_cost_estimate,
            w.environmental_risk_score,
            ua.water_available,
            ua.water_at_site,
            ua.water_connection_fee,
            ua.sewer_available,
            ua.sewer_at_site,
            ua.road_frontage_type,
            ua.road_classification,
            c.name AS county_name,
            osd.*,
            us.*
        FROM public.listings l
        JOIN public.properties p ON p.id = l.property_id
        JOIN public.counties c ON c.id = p.county_id
        LEFT JOIN public.parcel_data pd ON pd.property_id = p.id
        LEFT JOIN public.zoning z ON z.property_id = p.id
        LEFT JOIN public.flood_zones fz ON fz.property_id = p.id
        LEFT JOIN public.wetlands w ON w.property_id = p.id
        LEFT JOIN public.utility_access ua ON ua.property_id = p.id
        LEFT JOIN LATERAL (
            SELECT * FROM public.opportunity_score_details
            WHERE listing_id = l.id
            ORDER BY calculated_at DESC
            LIMIT 1
        ) osd ON TRUE
        LEFT JOIN LATERAL (
            SELECT * FROM public.underwriting_snapshots
            WHERE listing_id = l.id
            ORDER BY calculated_at DESC
            LIMIT 1
        ) us ON TRUE
        WHERE l.id = $1
    """
    async with get_connection() as conn:
        return await conn.fetchrow(query, listing_id)


async def get_active_listings_for_scoring() -> list[asyncpg.Record]:
    """Return all active listings with joined parcel data for the scoring engine."""
    query = """
        SELECT
            l.id             AS listing_id,
            l.property_id,
            l.list_price     AS listing_price,
            l.price_per_acre,
            l.days_on_market,
            p.county_id,
            p.lot_size_acres AS gross_acreage,
            pd.annual_taxes,
            pd.land_value,
            pd.assessed_value,
            z.max_density_units_per_acre,
            z.upzoning_potential,
            fz.pct_parcel_in_flood_zone AS sfha_pct,
            fz.is_special_flood_hazard,
            w.wetland_pct,
            w.has_wetlands,
            w.environmental_risk_score,
            ua.water_available,
            ua.water_at_site,
            ua.sewer_available,
            ua.sewer_at_site,
            ua.road_frontage_type,
            ua.road_classification,
            os.in_opportunity_zone,
            os.in_cra
        FROM public.listings l
        JOIN public.properties p ON p.id = l.property_id
        LEFT JOIN public.parcel_data pd ON pd.property_id = p.id
        LEFT JOIN public.zoning z ON z.property_id = p.id
        LEFT JOIN public.flood_zones fz ON fz.property_id = p.id
        LEFT JOIN public.wetlands w ON w.property_id = p.id
        LEFT JOIN public.utility_access ua ON ua.property_id = p.id
        LEFT JOIN public.opportunity_scores os ON os.property_id = p.id
        WHERE l.status = 'active'
          AND l.is_current = TRUE
    """
    async with get_connection() as conn:
        return await conn.fetch(query)


async def get_listing_by_id(listing_id: UUID) -> Optional[asyncpg.Record]:
    """Return a single listing row by ID."""
    query = "SELECT * FROM public.listings WHERE id = $1"
    async with get_connection() as conn:
        return await conn.fetchrow(query, listing_id)


async def upsert_listing(data: dict[str, Any]) -> UUID:
    """Insert or update a listing record. Returns the listing UUID."""
    query = """
        INSERT INTO public.listings (
            property_id, mls_number, listing_source, listing_type,
            list_price, price_per_acre, list_date, expiration_date,
            days_on_market, status, listing_agent_name, listing_agent_email,
            listing_brokerage, listing_url, description, is_current
        ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15, $16
        )
        ON CONFLICT (id) DO UPDATE SET
            list_price        = EXCLUDED.list_price,
            price_per_acre    = EXCLUDED.price_per_acre,
            days_on_market    = EXCLUDED.days_on_market,
            status            = EXCLUDED.status,
            listing_agent_name = EXCLUDED.listing_agent_name,
            listing_agent_email = EXCLUDED.listing_agent_email,
            listing_url       = EXCLUDED.listing_url,
            description       = EXCLUDED.description,
            updated_at        = NOW()
        RETURNING id
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            query,
            data.get("property_id"),
            data.get("mls_number"),
            data.get("listing_source"),
            data.get("listing_type"),
            data.get("list_price"),
            data.get("price_per_acre"),
            data.get("list_date"),
            data.get("expiration_date"),
            data.get("days_on_market"),
            data.get("status", "active"),
            data.get("listing_agent_name"),
            data.get("listing_agent_email"),
            data.get("listing_brokerage"),
            data.get("listing_url"),
            data.get("description"),
            data.get("is_current", True),
        )
        return row["id"]


async def upsert_property(data: dict[str, Any]) -> UUID:
    """Insert or update a property record. Returns the property UUID."""
    query = """
        INSERT INTO public.properties (
            parcel_id, county_id, municipality_id,
            address_street, address_city, address_state, address_zip,
            latitude, longitude, lot_size_acres, is_vacant, source
        ) VALUES (
            $1, $2, $3,
            $4, $5, $6, $7,
            $8, $9, $10, $11, $12
        )
        ON CONFLICT (parcel_id, county_id) DO UPDATE SET
            address_street  = EXCLUDED.address_street,
            address_city    = EXCLUDED.address_city,
            address_zip     = EXCLUDED.address_zip,
            latitude        = EXCLUDED.latitude,
            longitude       = EXCLUDED.longitude,
            lot_size_acres  = EXCLUDED.lot_size_acres,
            is_vacant       = EXCLUDED.is_vacant,
            updated_at      = NOW()
        RETURNING id
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            query,
            data.get("parcel_id"),
            data.get("county_id"),
            data.get("municipality_id"),
            data.get("address_street"),
            data.get("address_city"),
            data.get("address_state", "FL"),
            data.get("address_zip"),
            data.get("latitude"),
            data.get("longitude"),
            data.get("lot_size_acres"),
            data.get("is_vacant", False),
            data.get("source"),
        )
        return row["id"]
