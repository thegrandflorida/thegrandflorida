from __future__ import annotations

from typing import Optional

import asyncpg

try:
    from db.connection import get_connection  # type: ignore[import]
except ImportError:
    from apps.api.db.connection import get_connection


async def get_latest_rent_data(county_id: int) -> Optional[asyncpg.Record]:
    """Return the most recent rent_data row for a county."""
    query = """
        SELECT * FROM public.rent_data
        WHERE county_id = $1
        ORDER BY period_year DESC, period_month DESC
        LIMIT 1
    """
    async with get_connection() as conn:
        return await conn.fetchrow(query, county_id)


async def get_rent_trend(county_id: int, months: int = 12) -> list[asyncpg.Record]:
    """Return up to `months` months of rent data for a county, newest first."""
    query = """
        SELECT * FROM public.rent_data
        WHERE county_id = $1
        ORDER BY period_year DESC, period_month DESC
        LIMIT $2
    """
    async with get_connection() as conn:
        return await conn.fetch(query, county_id, months)


async def get_demographics(county_id: int) -> Optional[asyncpg.Record]:
    """Return the most recent demographic_data row for a county."""
    query = """
        SELECT * FROM public.demographic_data
        WHERE county_id = $1
        ORDER BY acs_vintage_year DESC
        LIMIT 1
    """
    async with get_connection() as conn:
        return await conn.fetchrow(query, county_id)


async def get_employment(county_id: int) -> Optional[asyncpg.Record]:
    """Return the most recent employment_data row for a county."""
    query = """
        SELECT * FROM public.employment_data
        WHERE county_id = $1
        ORDER BY period_year DESC, period_month DESC
        LIMIT 1
    """
    async with get_connection() as conn:
        return await conn.fetchrow(query, county_id)


async def get_supply_pipeline(county_id: int) -> Optional[asyncpg.Record]:
    """Return the most recent supply_pipeline row for a county."""
    query = """
        SELECT * FROM public.supply_pipeline
        WHERE county_id = $1
        ORDER BY period_year DESC, period_month DESC
        LIMIT 1
    """
    async with get_connection() as conn:
        return await conn.fetchrow(query, county_id)


async def get_county_market_snapshot(county_id: int) -> Optional[asyncpg.Record]:
    """Return a joined market snapshot for a county using lateral subqueries."""
    query = """
        SELECT
            c.id           AS county_id,
            c.name         AS county_name,
            rd.*,
            dd.*,
            ed.*,
            sp.*
        FROM public.counties c
        LEFT JOIN LATERAL (
            SELECT * FROM public.rent_data
            WHERE county_id = c.id
            ORDER BY period_year DESC, period_month DESC
            LIMIT 1
        ) rd ON TRUE
        LEFT JOIN LATERAL (
            SELECT * FROM public.demographic_data
            WHERE county_id = c.id
            ORDER BY acs_vintage_year DESC
            LIMIT 1
        ) dd ON TRUE
        LEFT JOIN LATERAL (
            SELECT * FROM public.employment_data
            WHERE county_id = c.id
            ORDER BY period_year DESC, period_month DESC
            LIMIT 1
        ) ed ON TRUE
        LEFT JOIN LATERAL (
            SELECT * FROM public.supply_pipeline
            WHERE county_id = c.id
            ORDER BY period_year DESC, period_month DESC
            LIMIT 1
        ) sp ON TRUE
        WHERE c.id = $1
    """
    async with get_connection() as conn:
        return await conn.fetchrow(query, county_id)
