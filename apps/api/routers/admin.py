"""
Admin router — sync triggers, rescore, logs, digest management.
Prefix: /admin   Tags: admin
All endpoints require admin role.
"""
from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any, List, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..dependencies import get_current_user, get_db

router = APIRouter(prefix="/admin", tags=["admin"])

# ---------------------------------------------------------------------------
# Role guard
# ---------------------------------------------------------------------------

INNGEST_BASE_URL = os.getenv("INNGEST_EVENT_KEY_URL", "https://inn.gs/e")
INNGEST_EVENT_KEY = os.getenv("INNGEST_EVENT_KEY", "")


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin role required")
    return current_user


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class SyncTriggerResponse(BaseModel):
    event_id: Optional[str] = None
    accepted: bool
    message: str


class SyncLogEntry(BaseModel):
    id: UUID
    source: str
    county_id: Optional[int] = None
    job_id: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    records_fetched: int
    records_inserted: int
    records_updated: int
    records_skipped: int
    records_errored: int
    status: str
    error_log: Optional[Any] = None


class DigestPreviewResponse(BaseModel):
    date: date
    listing_count: int
    html_preview: str
    sms_preview: str
    recipient_count: int


# ---------------------------------------------------------------------------
# Inngest event helper
# ---------------------------------------------------------------------------


async def _send_inngest_event(event_name: str, data: dict) -> str:
    """Fire an Inngest event and return the event id."""
    payload = {"name": event_name, "data": data}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{INNGEST_BASE_URL}/{INNGEST_EVENT_KEY}",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code not in (200, 201, 204):
            raise HTTPException(
                status_code=502,
                detail=f"Inngest returned {resp.status_code}: {resp.text[:200]}",
            )
        body = resp.json() if resp.content else {}
        return body.get("ids", [None])[0] or "queued"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/sync/listings", response_model=SyncTriggerResponse)
async def trigger_listing_ingest(
    admin: dict = Depends(require_admin),
) -> SyncTriggerResponse:
    """Trigger the listing_ingest Inngest job."""
    event_id = await _send_inngest_event("sync/county-pa.trigger", {"full_load": False})
    return SyncTriggerResponse(event_id=event_id, accepted=True, message="Listing ingest job queued")


@router.post("/sync/parcels", response_model=SyncTriggerResponse)
async def trigger_parcel_enrich(
    admin: dict = Depends(require_admin),
) -> SyncTriggerResponse:
    """Trigger the parcel_enrich Inngest job for all counties."""
    event_id = await _send_inngest_event("sync/county-pa.trigger", {"full_load": True})
    return SyncTriggerResponse(event_id=event_id, accepted=True, message="Parcel enrichment job queued")


@router.post("/rescore/all", response_model=SyncTriggerResponse)
async def rescore_all(
    admin: dict = Depends(require_admin),
) -> SyncTriggerResponse:
    """Trigger a scoring run for all active listings."""
    event_id = await _send_inngest_event(
        "property/batch-score.requested",
        {"limit": 10000},
    )
    return SyncTriggerResponse(event_id=event_id, accepted=True, message="Batch rescore job queued")


@router.post("/rescore/{listing_id}", response_model=SyncTriggerResponse)
async def rescore_listing(
    listing_id: UUID,
    admin: dict = Depends(require_admin),
    db=Depends(get_db),
) -> SyncTriggerResponse:
    """Trigger a rescore for a single listing."""
    # Resolve property_id
    row = await db.fetch_one(
        "SELECT property_id FROM listings WHERE id = :lid",
        values={"lid": str(listing_id)},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")

    event_id = await _send_inngest_event(
        "property/score.requested",
        {"property_id": str(row["property_id"])},
    )
    return SyncTriggerResponse(event_id=event_id, accepted=True, message=f"Rescore queued for listing {listing_id}")


@router.get("/sync/logs", response_model=List[SyncLogEntry])
async def get_sync_logs(
    admin: dict = Depends(require_admin),
    db=Depends(get_db),
) -> List[SyncLogEntry]:
    """Last 50 sync log entries."""
    rows = await db.fetch_all(
        "SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 50"
    )
    return [SyncLogEntry(**dict(r)) for r in rows]


@router.post("/digest/preview", response_model=DigestPreviewResponse)
async def preview_digest(
    admin: dict = Depends(require_admin),
    db=Depends(get_db),
) -> DigestPreviewResponse:
    """Build and return today's morning digest without sending."""
    from ..services.notifications.digest import build_morning_digest

    today = date.today()
    digest = await build_morning_digest(today, db)

    # Count eligible users
    count_row = await db.fetch_one(
        """
        SELECT COUNT(*) AS cnt FROM users
        WHERE (notification_preferences->>'email')::boolean = TRUE
          OR (notification_preferences->>'sms')::boolean = TRUE
        """
    )
    recipient_count = count_row["cnt"] if count_row else 0

    return DigestPreviewResponse(
        date=today,
        listing_count=len(digest.get("listings", [])),
        html_preview=digest.get("html", ""),
        sms_preview=digest.get("sms", ""),
        recipient_count=recipient_count,
    )


@router.post("/digest/send", response_model=SyncTriggerResponse)
async def send_digest(
    admin: dict = Depends(require_admin),
) -> SyncTriggerResponse:
    """Trigger the daily digest send job via Inngest."""
    event_id = await _send_inngest_event("email/daily-digest.send", {})
    return SyncTriggerResponse(event_id=event_id, accepted=True, message="Daily digest send job queued")
