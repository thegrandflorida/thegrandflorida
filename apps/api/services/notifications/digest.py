"""
Morning digest orchestration service.
Builds email and SMS content from today's ranked deals and dispatches to users.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from .email import build_digest_html, send_digest_email
from .sms import build_digest_sms, send_digest_sms

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DAILY_DIGEST_QUERY = """
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
    c.name            AS county_name
FROM daily_rankings dr
JOIN listings      l  ON l.id           = dr.listing_id
JOIN properties    p  ON p.id           = dr.property_id
JOIN counties      c  ON c.id           = p.county_id
WHERE dr.in_morning_digest = TRUE
  AND dr.ranked_date = :ranked_date
ORDER BY dr.rank_position ASC
LIMIT 10
"""


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------


async def build_morning_digest(ranked_date: date, db) -> dict[str, Any]:
    """
    Query daily_rankings for the given date and build email + SMS content.

    Returns:
        {
            "html": str,
            "sms": str,
            "listings": list[dict],
        }
    """
    rows = await db.fetch_all(
        _DAILY_DIGEST_QUERY,
        values={"ranked_date": ranked_date},
    )
    listings = [dict(r) for r in rows]

    html = build_digest_html(listings)
    sms = build_digest_sms(listings)

    return {
        "html": html,
        "sms": sms,
        "listings": listings,
    }


async def send_morning_digest(
    user_email: str,
    user_phone: Optional[str],
    ranked_date: date,
    db,
) -> dict[str, Any]:
    """
    Build the morning digest and send to a single user via email and (optionally) SMS.

    Returns:
        {
            "email_sent": bool,
            "sms_sent": bool,
            "listing_count": int,
        }
    """
    digest = await build_morning_digest(ranked_date, db)
    html = digest["html"]
    sms_text = digest["sms"]
    listings = digest["listings"]

    email_sent = False
    sms_sent = False

    if user_email:
        try:
            email_sent = send_digest_email(user_email, html)
        except Exception as exc:
            logger.error("Email send failed for %s: %s", user_email, exc)

    if user_phone:
        try:
            sms_sent = send_digest_sms(user_phone, sms_text)
        except Exception as exc:
            logger.error("SMS send failed for %s: %s", user_phone, exc)

    return {
        "email_sent": email_sent,
        "sms_sent": sms_sent,
        "listing_count": len(listings),
    }
