"""
SMS notification service — digest SMS builder and Twilio sender.
"""
from __future__ import annotations

import logging
import os
from typing import List

from twilio.rest import Client as TwilioClient

_TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
_TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
_TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
_APP_BASE_URL = os.getenv("APP_BASE_URL", "https://app.thegrandflorida.com")

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SMS builder
# ---------------------------------------------------------------------------


def build_digest_sms(rankings: list) -> str:
    """
    Build a plain-text deal summary for SMS — maximum 3 deals, under 320 chars.

    Each deal line: #1 [Address] | Score A 87 | $2.1M | View: <url>
    """
    lines: list[str] = ["🏗 FL Deals Today:"]
    for i, item in enumerate(rankings[:3], start=1):
        if hasattr(item, "model_dump"):
            d = item.model_dump()
        else:
            d = dict(item)

        address = (d.get("situs_address") or "Address on file")[:28]
        grade = d.get("score_grade") or "?"
        score = int(d.get("overall_score") or 0)
        price = d.get("list_price")
        price_str = ""
        if price:
            if price >= 1_000_000:
                price_str = f"${price / 1_000_000:.1f}M"
            else:
                price_str = f"${price / 1_000:.0f}K"

        listing_id = d.get("listing_id") or ""
        url = f"{_APP_BASE_URL}/d/{listing_id}"  # short path

        line = f"#{i} {address} | {grade}{score}"
        if price_str:
            line += f" | {price_str}"
        line += f" {url}"
        lines.append(line)

    message = "\n".join(lines)

    # Hard-truncate to 320 chars as a safety net
    if len(message) > 320:
        message = message[:317] + "..."

    return message


# ---------------------------------------------------------------------------
# Sender
# ---------------------------------------------------------------------------


def send_digest_sms(to_number: str, message: str) -> bool:
    """
    Send an SMS via Twilio.
    Returns True on success, False on failure.
    """
    if not all([_TWILIO_ACCOUNT_SID, _TWILIO_AUTH_TOKEN, _TWILIO_FROM_NUMBER]):
        logger.error("Twilio credentials not configured — SMS not sent")
        return False

    try:
        client = TwilioClient(_TWILIO_ACCOUNT_SID, _TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=message,
            from_=_TWILIO_FROM_NUMBER,
            to=to_number,
        )
        logger.info("SMS sent to %s — SID %s", to_number, msg.sid)
        return True
    except Exception as exc:
        logger.error("Twilio send failed to %s: %s", to_number, exc)
        return False
