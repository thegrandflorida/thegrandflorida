"""
Watchlist router — favorites management, stage tracking, notes.
Prefix: /watchlist   Tags: watchlist
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from ..dependencies import get_current_user, get_db

router = APIRouter(prefix="/watchlist", tags=["watchlist"])

ALLOWED_STAGES = {"New", "Under Review", "Offer Submitted", "Dead", "Closed"}

# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class WatchlistItem(BaseModel):
    favorite_id: UUID
    listing_id: UUID
    property_id: UUID
    situs_address: Optional[str] = None
    county_id: int
    list_price: Optional[float] = None
    lot_size_acres: Optional[float] = None
    overall_score: Optional[float] = None
    score_grade: Optional[str] = None
    status: str
    stage: str
    notes: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    added_at: datetime
    listing_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class AddWatchlistBody(BaseModel):
    listing_id: UUID


class UpdateStageBody(BaseModel):
    status: str


class AddNoteBody(BaseModel):
    note: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=List[WatchlistItem])
async def get_watchlist(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> List[WatchlistItem]:
    """All favorites for the current user with listing + score data."""
    rows = await db.fetch_all(
        """
        SELECT
            f.id            AS favorite_id,
            f.property_id,
            f.stage,
            f.notes,
            f.tags,
            f.created_at    AS added_at,
            l.id            AS listing_id,
            l.list_price,
            l.days_on_market,
            l.status,
            l.listing_url,
            l.photos,
            p.address_street AS situs_address,
            p.county_id,
            p.lot_size_acres,
            os.overall_score,
            os.score_grade
        FROM favorites        f
        JOIN properties       p  ON p.id          = f.property_id
        JOIN listings         l  ON l.property_id  = p.id AND l.is_current = TRUE
        LEFT JOIN opportunity_scores os ON os.property_id = p.id
        WHERE f.user_id = :user_id
        ORDER BY f.created_at DESC
        """,
        values={"user_id": current_user["id"]},
    )

    items = []
    for r in rows:
        row = dict(r)
        photos = row.get("photos") or []
        thumbnail = photos[0]["url"] if photos else None
        items.append(
            WatchlistItem(
                favorite_id=row["favorite_id"],
                listing_id=row["listing_id"],
                property_id=row["property_id"],
                situs_address=row.get("situs_address"),
                county_id=row.get("county_id") or 0,
                list_price=row.get("list_price"),
                lot_size_acres=row.get("lot_size_acres"),
                overall_score=row.get("overall_score"),
                score_grade=row.get("score_grade"),
                status=row.get("status") or "active",
                stage=row.get("stage") or "New",
                notes=row.get("notes"),
                tags=row.get("tags") or [],
                added_at=row["added_at"],
                listing_url=row.get("listing_url"),
                thumbnail_url=thumbnail,
            )
        )
    return items


@router.post("", response_model=WatchlistItem, status_code=201)
async def add_to_watchlist(
    body: AddWatchlistBody,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> WatchlistItem:
    """Add a listing to the watchlist (stage = New)."""
    # Resolve property_id from listing_id
    listing_row = await db.fetch_one(
        "SELECT id, property_id, list_price, status, listing_url, photos FROM listings WHERE id = :lid",
        values={"lid": str(body.listing_id)},
    )
    if not listing_row:
        raise HTTPException(status_code=404, detail="Listing not found")
    lr = dict(listing_row)

    # Idempotent — return existing if already favorited
    existing = await db.fetch_one(
        "SELECT * FROM favorites WHERE user_id = :uid AND property_id = :pid",
        values={"uid": current_user["id"], "pid": str(lr["property_id"])},
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already in watchlist")

    now = datetime.now(timezone.utc)
    fav_id = await db.execute(
        """
        INSERT INTO favorites (user_id, property_id, stage, created_at)
        VALUES (:user_id, :property_id, 'New', :now)
        RETURNING id
        """,
        values={
            "user_id": current_user["id"],
            "property_id": str(lr["property_id"]),
            "now": now,
        },
    )

    prop_row = await db.fetch_one(
        "SELECT address_street, county_id, lot_size_acres FROM properties WHERE id = :pid",
        values={"pid": str(lr["property_id"])},
    )
    pr = dict(prop_row) if prop_row else {}

    score_row = await db.fetch_one(
        "SELECT overall_score, score_grade FROM opportunity_scores WHERE property_id = :pid",
        values={"pid": str(lr["property_id"])},
    )
    sr = dict(score_row) if score_row else {}

    photos = lr.get("photos") or []
    thumbnail = photos[0]["url"] if photos else None

    return WatchlistItem(
        favorite_id=fav_id,
        listing_id=body.listing_id,
        property_id=lr["property_id"],
        situs_address=pr.get("address_street"),
        county_id=pr.get("county_id") or 0,
        list_price=lr.get("list_price"),
        lot_size_acres=pr.get("lot_size_acres"),
        overall_score=sr.get("overall_score"),
        score_grade=sr.get("score_grade"),
        status=lr.get("status") or "active",
        stage="New",
        notes=None,
        tags=[],
        added_at=now,
        listing_url=lr.get("listing_url"),
        thumbnail_url=thumbnail,
    )


@router.patch("/{listing_id}/status", status_code=204)
async def update_stage(
    listing_id: UUID = Path(...),
    body: UpdateStageBody = ...,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> None:
    """Update the deal stage for a watchlist entry."""
    if body.status not in ALLOWED_STAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(ALLOWED_STAGES))}",
        )

    result = await db.execute(
        """
        UPDATE favorites f
        SET stage = :stage
        FROM listings l
        JOIN properties p ON p.id = l.property_id
        WHERE f.property_id = p.id
          AND l.id = :listing_id
          AND f.user_id = :user_id
        """,
        values={
            "stage": body.status,
            "listing_id": str(listing_id),
            "user_id": current_user["id"],
        },
    )
    if result == 0:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")


@router.post("/{listing_id}/note", status_code=204)
async def add_note(
    listing_id: UUID = Path(...),
    body: AddNoteBody = ...,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> None:
    """Append a timestamped note to the property notes for this listing."""
    listing_row = await db.fetch_one(
        "SELECT property_id FROM listings WHERE id = :lid",
        values={"lid": str(listing_id)},
    )
    if not listing_row:
        raise HTTPException(status_code=404, detail="Listing not found")

    property_id = listing_row["property_id"]
    now = datetime.now(timezone.utc)

    await db.execute(
        """
        INSERT INTO property_notes (user_id, property_id, body, is_private, created_at, updated_at)
        VALUES (:user_id, :property_id, :body, TRUE, :now, :now)
        """,
        values={
            "user_id": current_user["id"],
            "property_id": str(property_id),
            "body": body.note,
            "now": now,
        },
    )


@router.delete("/{listing_id}", status_code=204)
async def remove_from_watchlist(
    listing_id: UUID = Path(...),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> None:
    """Remove a listing from the current user's watchlist."""
    result = await db.execute(
        """
        DELETE FROM favorites
        WHERE user_id = :user_id
          AND property_id = (
              SELECT p.id FROM listings l
              JOIN properties p ON p.id = l.property_id
              WHERE l.id = :listing_id
          )
        """,
        values={"user_id": current_user["id"], "listing_id": str(listing_id)},
    )
    if result == 0:
        raise HTTPException(status_code=404, detail="Watchlist entry not found")
