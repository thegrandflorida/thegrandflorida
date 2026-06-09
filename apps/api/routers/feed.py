"""
Feed router — daily rankings, filtered ranking queries, and history.
Prefix: /feed   Tags: feed
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..dependencies import get_current_user, get_db, get_redis
from ..services.cache import cache_key, get_cached, set_cached

router = APIRouter(prefix="/feed", tags=["feed"])

# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class DealFeedItem(BaseModel):
    listing_id: UUID
    property_id: UUID
    rank: int
    overall_score: float
    score_grade: str
    score_label: Optional[str] = None
    situs_address: Optional[str] = None
    county_id: int
    county_name: Optional[str] = None
    list_price: Optional[float] = None
    price_per_acre: Optional[float] = None
    lot_size_acres: Optional[float] = None
    days_on_market: Optional[int] = None
    in_opportunity_zone: bool = False
    zoning_code: Optional[str] = None
    zoning_description: Optional[str] = None
    risk_flags: List[str] = Field(default_factory=list)
    upside_flags: List[str] = Field(default_factory=list)
    ai_summary: Optional[str] = None
    scored_at: Optional[datetime] = None
    listing_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    ranked_date: date


class PaginationInfo(BaseModel):
    page: int
    per_page: int
    total: int
    total_pages: int


class DealFeedResponse(BaseModel):
    items: List[DealFeedItem]
    pagination: PaginationInfo


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SCORE_LABEL_MAP = {
    "A": "Top Tier",
    "B": "Strong",
    "C": "Moderate",
    "D": "Watch",
    "F": "Pass",
}


def _row_to_feed_item(row: dict[str, Any]) -> DealFeedItem:
    photos = row.get("photos") or []
    thumbnail = photos[0]["url"] if photos else None
    grade = row.get("score_grade") or "F"
    return DealFeedItem(
        listing_id=row["listing_id"],
        property_id=row["property_id"],
        rank=row.get("rank_position", 0),
        overall_score=row.get("overall_score") or 0.0,
        score_grade=grade,
        score_label=_SCORE_LABEL_MAP.get(grade),
        situs_address=row.get("situs_address"),
        county_id=row.get("county_id") or 0,
        county_name=row.get("county_name"),
        list_price=row.get("list_price"),
        price_per_acre=row.get("price_per_acre"),
        lot_size_acres=row.get("lot_size_acres"),
        days_on_market=row.get("days_on_market"),
        in_opportunity_zone=bool(row.get("in_opportunity_zone")),
        zoning_code=row.get("zoning_code"),
        zoning_description=row.get("zoning_description"),
        risk_flags=row.get("risk_flags") or [],
        upside_flags=row.get("upside_flags") or [],
        ai_summary=row.get("ai_summary"),
        scored_at=row.get("scored_at"),
        listing_url=row.get("listing_url"),
        thumbnail_url=thumbnail,
        ranked_date=row.get("ranked_date") or date.today(),
    )


_DAILY_RANKINGS_QUERY = """
SELECT
    dr.id            AS ranking_id,
    dr.listing_id,
    dr.property_id,
    dr.rank_position,
    dr.overall_score,
    dr.score_grade,
    dr.in_opportunity_zone,
    dr.ranked_date,
    l.list_price,
    l.price_per_acre,
    l.days_on_market,
    l.listing_url,
    l.photos,
    p.address_street  AS situs_address,
    p.lot_size_acres,
    p.county_id,
    c.name            AS county_name,
    z.zoning_code,
    z.zoning_description,
    os.risk_flags,
    os.upside_flags,
    os.ai_summary,
    os.scored_at
FROM daily_rankings dr
JOIN listings      l  ON l.id           = dr.listing_id
JOIN properties    p  ON p.id           = dr.property_id
JOIN counties      c  ON c.id           = p.county_id
LEFT JOIN zoning   z  ON z.property_id  = dr.property_id
LEFT JOIN opportunity_scores os ON os.property_id = dr.property_id
WHERE dr.in_morning_digest = TRUE
  AND dr.ranked_date = :ranked_date
ORDER BY dr.rank_position ASC
LIMIT 10
"""

_RANKINGS_BASE_QUERY = """
SELECT
    dr.listing_id,
    dr.property_id,
    dr.rank_position,
    dr.overall_score,
    dr.score_grade,
    dr.in_opportunity_zone,
    dr.ranked_date,
    l.list_price,
    l.price_per_acre,
    l.days_on_market,
    l.listing_url,
    l.photos,
    p.address_street  AS situs_address,
    p.lot_size_acres,
    p.county_id,
    c.name            AS county_name,
    z.zoning_code,
    z.zoning_description,
    os.risk_flags,
    os.upside_flags,
    os.ai_summary,
    os.scored_at
FROM daily_rankings dr
JOIN listings      l  ON l.id           = dr.listing_id
JOIN properties    p  ON p.id           = dr.property_id
JOIN counties      c  ON c.id           = p.county_id
LEFT JOIN zoning   z  ON z.property_id  = dr.property_id
LEFT JOIN opportunity_scores os ON os.property_id = dr.property_id
"""

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/daily", response_model=List[DealFeedItem])
async def get_daily_feed(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> List[DealFeedItem]:
    """Return top-10 morning digest deals for today. Cached for 5 minutes."""
    today = date.today()
    ck = cache_key("feed", "daily", str(today))

    cached = await get_cached(redis, ck)
    if cached is not None:
        return [DealFeedItem(**item) for item in cached]

    rows = await db.fetch_all(
        _DAILY_RANKINGS_QUERY, values={"ranked_date": today}
    )
    items = [_row_to_feed_item(dict(r)) for r in rows]

    await set_cached(redis, ck, [i.model_dump(mode="json") for i in items], ttl_seconds=300)
    return items


@router.get("/rankings", response_model=DealFeedResponse)
async def get_rankings(
    county_id: Optional[List[int]] = Query(default=None),
    min_score: Optional[float] = Query(default=None, ge=0, le=100),
    max_score: Optional[float] = Query(default=None, ge=0, le=100),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    min_acres: Optional[float] = Query(default=None, ge=0),
    max_acres: Optional[float] = Query(default=None, ge=0),
    score_label: Optional[List[str]] = Query(default=None),
    opportunity_zone: Optional[bool] = Query(default=None),
    days_on_market_min: Optional[int] = Query(default=None, ge=0),
    sort_by: str = Query(default="score", pattern="^(score|price|acres|dom)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> DealFeedResponse:
    """Paginated ranked listings with all filters applied in SQL."""
    today = date.today()
    where_clauses = ["dr.ranked_date = :ranked_date"]
    params: dict[str, Any] = {"ranked_date": today}

    if county_id:
        where_clauses.append("p.county_id = ANY(:county_id)")
        params["county_id"] = county_id

    if min_score is not None:
        where_clauses.append("dr.overall_score >= :min_score")
        params["min_score"] = min_score

    if max_score is not None:
        where_clauses.append("dr.overall_score <= :max_score")
        params["max_score"] = max_score

    if min_price is not None:
        where_clauses.append("l.list_price >= :min_price")
        params["min_price"] = min_price

    if max_price is not None:
        where_clauses.append("l.list_price <= :max_price")
        params["max_price"] = max_price

    if min_acres is not None:
        where_clauses.append("p.lot_size_acres >= :min_acres")
        params["min_acres"] = min_acres

    if max_acres is not None:
        where_clauses.append("p.lot_size_acres <= :max_acres")
        params["max_acres"] = max_acres

    if score_label:
        grades = [g for g, lbl in _SCORE_LABEL_MAP.items() if lbl in score_label or g in score_label]
        if grades:
            where_clauses.append("dr.score_grade = ANY(:grades)")
            params["grades"] = grades

    if opportunity_zone is not None:
        where_clauses.append("dr.in_opportunity_zone = :opportunity_zone")
        params["opportunity_zone"] = opportunity_zone

    if days_on_market_min is not None:
        where_clauses.append("l.days_on_market >= :dom_min")
        params["dom_min"] = days_on_market_min

    sort_expr = {
        "score": "dr.overall_score DESC",
        "price": "l.list_price ASC NULLS LAST",
        "acres": "p.lot_size_acres DESC NULLS LAST",
        "dom": "l.days_on_market DESC NULLS LAST",
    }[sort_by]

    where_sql = "WHERE " + " AND ".join(where_clauses)

    count_sql = f"""
        SELECT COUNT(*) AS total
        FROM daily_rankings dr
        JOIN listings   l ON l.id = dr.listing_id
        JOIN properties p ON p.id = dr.property_id
        {where_sql}
    """
    count_row = await db.fetch_one(count_sql, values=params)
    total = count_row["total"] if count_row else 0

    offset = (page - 1) * per_page
    data_sql = f"""
        {_RANKINGS_BASE_QUERY}
        {where_sql}
        ORDER BY {sort_expr}
        LIMIT :limit OFFSET :offset
    """
    params["limit"] = per_page
    params["offset"] = offset

    rows = await db.fetch_all(data_sql, values=params)
    items = [_row_to_feed_item(dict(r)) for r in rows]

    return DealFeedResponse(
        items=items,
        pagination=PaginationInfo(
            page=page,
            per_page=per_page,
            total=total,
            total_pages=max(1, -(-total // per_page)),
        ),
    )


@router.get("/rankings/history", response_model=DealFeedResponse)
async def get_rankings_history(
    date_param: date = Query(alias="date"),
    county_id: Optional[List[int]] = Query(default=None),
    min_score: Optional[float] = Query(default=None, ge=0, le=100),
    max_score: Optional[float] = Query(default=None, ge=0, le=100),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    min_acres: Optional[float] = Query(default=None, ge=0),
    max_acres: Optional[float] = Query(default=None, ge=0),
    score_label: Optional[List[str]] = Query(default=None),
    opportunity_zone: Optional[bool] = Query(default=None),
    days_on_market_min: Optional[int] = Query(default=None, ge=0),
    sort_by: str = Query(default="score", pattern="^(score|price|acres|dom)$"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> DealFeedResponse:
    """Same as /rankings but for a historical date."""
    where_clauses = ["dr.ranked_date = :ranked_date"]
    params: dict[str, Any] = {"ranked_date": date_param}

    if county_id:
        where_clauses.append("p.county_id = ANY(:county_id)")
        params["county_id"] = county_id
    if min_score is not None:
        where_clauses.append("dr.overall_score >= :min_score")
        params["min_score"] = min_score
    if max_score is not None:
        where_clauses.append("dr.overall_score <= :max_score")
        params["max_score"] = max_score
    if min_price is not None:
        where_clauses.append("l.list_price >= :min_price")
        params["min_price"] = min_price
    if max_price is not None:
        where_clauses.append("l.list_price <= :max_price")
        params["max_price"] = max_price
    if min_acres is not None:
        where_clauses.append("p.lot_size_acres >= :min_acres")
        params["min_acres"] = min_acres
    if max_acres is not None:
        where_clauses.append("p.lot_size_acres <= :max_acres")
        params["max_acres"] = max_acres
    if score_label:
        grades = [g for g, lbl in _SCORE_LABEL_MAP.items() if lbl in score_label or g in score_label]
        if grades:
            where_clauses.append("dr.score_grade = ANY(:grades)")
            params["grades"] = grades
    if opportunity_zone is not None:
        where_clauses.append("dr.in_opportunity_zone = :opportunity_zone")
        params["opportunity_zone"] = opportunity_zone
    if days_on_market_min is not None:
        where_clauses.append("l.days_on_market >= :dom_min")
        params["dom_min"] = days_on_market_min

    sort_expr = {
        "score": "dr.overall_score DESC",
        "price": "l.list_price ASC NULLS LAST",
        "acres": "p.lot_size_acres DESC NULLS LAST",
        "dom": "l.days_on_market DESC NULLS LAST",
    }[sort_by]

    where_sql = "WHERE " + " AND ".join(where_clauses)

    count_sql = f"""
        SELECT COUNT(*) AS total
        FROM daily_rankings dr
        JOIN listings   l ON l.id = dr.listing_id
        JOIN properties p ON p.id = dr.property_id
        {where_sql}
    """
    count_row = await db.fetch_one(count_sql, values=params)
    total = count_row["total"] if count_row else 0

    offset = (page - 1) * per_page
    data_sql = f"""
        {_RANKINGS_BASE_QUERY}
        {where_sql}
        ORDER BY {sort_expr}
        LIMIT :limit OFFSET :offset
    """
    params["limit"] = per_page
    params["offset"] = offset

    rows = await db.fetch_all(data_sql, values=params)
    items = [_row_to_feed_item(dict(r)) for r in rows]

    return DealFeedResponse(
        items=items,
        pagination=PaginationInfo(
            page=page,
            per_page=per_page,
            total=total,
            total_pages=max(1, -(-total // per_page)),
        ),
    )
