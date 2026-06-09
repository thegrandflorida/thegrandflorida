"""
Email notification service — digest HTML builder and Resend sender.
"""
from __future__ import annotations

import os
from typing import List

import resend

resend.api_key = os.getenv("RESEND_API_KEY", "")

_FROM_ADDRESS = os.getenv("DIGEST_FROM_EMAIL", "digest@thegrandflorida.com")
_FROM_NAME = os.getenv("DIGEST_FROM_NAME", "Florida Multifamily Deal Finder")

# ---------------------------------------------------------------------------
# HTML builder
# ---------------------------------------------------------------------------

_GRADE_COLORS = {
    "A": "#16a34a",  # green-600
    "B": "#2563eb",  # blue-600
    "C": "#d97706",  # amber-600
    "D": "#dc2626",  # red-600
    "F": "#6b7280",  # gray-500
}

_APP_BASE_URL = os.getenv("APP_BASE_URL", "https://app.thegrandflorida.com")


def _format_currency(value) -> str:
    if value is None:
        return "—"
    try:
        v = float(value)
        if v >= 1_000_000:
            return f"${v / 1_000_000:.2f}M"
        if v >= 1_000:
            return f"${v / 1_000:.0f}K"
        return f"${v:,.0f}"
    except (TypeError, ValueError):
        return "—"


def _score_badge(score: float, grade: str) -> str:
    color = _GRADE_COLORS.get(grade, "#6b7280")
    return (
        f'<span style="display:inline-block;background:{color};color:#fff;'
        f'border-radius:4px;padding:2px 8px;font-weight:700;font-size:14px;">'
        f'{grade} &nbsp;{score:.0f}</span>'
    )


def build_digest_html(rankings: list) -> str:
    """
    Render a clean HTML email for the morning digest.

    `rankings` is a list of DealFeedItem-like objects or dicts with:
        listing_id, situs_address, county_name, list_price, lot_size_acres,
        overall_score, score_grade, in_opportunity_zone, listing_url
    """
    rows_html = ""
    for item in rankings[:10]:
        if hasattr(item, "model_dump"):
            d = item.model_dump()
        else:
            d = dict(item)

        listing_id = d.get("listing_id") or ""
        address = d.get("situs_address") or "Address on file"
        county = d.get("county_name") or ""
        price = _format_currency(d.get("list_price"))
        acres = d.get("lot_size_acres")
        acres_str = f"{acres:.2f} ac" if acres else "—"
        score = d.get("overall_score") or 0.0
        grade = d.get("score_grade") or "F"
        oz_badge = (
            '<span style="background:#7c3aed;color:#fff;border-radius:3px;'
            'padding:1px 5px;font-size:11px;margin-left:6px;">OZ</span>'
            if d.get("in_opportunity_zone")
            else ""
        )
        deal_url = d.get("listing_url") or f"{_APP_BASE_URL}/deals/{listing_id}"

        rows_html += f"""
        <tr>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-weight:600;font-size:15px;color:#111827;">
              {address}{oz_badge}
            </div>
            <div style="color:#6b7280;font-size:13px;margin-top:2px;">{county}</div>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">
            {_score_badge(score, grade)}
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">
            <div style="font-weight:600;">{price}</div>
            <div style="color:#6b7280;font-size:12px;">{acres_str}</div>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">
            <a href="{deal_url}"
               style="background:#1d4ed8;color:#fff;text-decoration:none;
                      border-radius:4px;padding:6px 14px;font-size:13px;
                      font-weight:600;display:inline-block;">
              View Deal
            </a>
          </td>
        </tr>
        """

    html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Florida Multifamily Deal Finder — Morning Digest</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="background:#1d4ed8;padding:24px 32px;">
              <div style="color:#fff;font-size:22px;font-weight:700;">
                🏗️ Florida Multifamily Deal Finder
              </div>
              <div style="color:#bfdbfe;font-size:14px;margin-top:4px;">
                Morning Digest — Top Opportunities
              </div>
            </td>
          </tr>
          <!-- Deals table -->
          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="text-align:left;padding:8px;font-size:12px;
                                color:#6b7280;text-transform:uppercase;
                                border-bottom:2px solid #e5e7eb;">Property</th>
                    <th style="text-align:right;padding:8px;font-size:12px;
                                color:#6b7280;text-transform:uppercase;
                                border-bottom:2px solid #e5e7eb;">Score</th>
                    <th style="text-align:right;padding:8px;font-size:12px;
                                color:#6b7280;text-transform:uppercase;
                                border-bottom:2px solid #e5e7eb;">Price / Size</th>
                    <th style="text-align:center;padding:8px;font-size:12px;
                                color:#6b7280;text-transform:uppercase;
                                border-bottom:2px solid #e5e7eb;"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows_html}
                </tbody>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;
                        border-top:1px solid #e5e7eb;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                You're receiving this because you opted in to deal alerts.
                <a href="{_APP_BASE_URL}/settings/notifications"
                   style="color:#6b7280;">Manage preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return html


# ---------------------------------------------------------------------------
# Sender
# ---------------------------------------------------------------------------


def send_digest_email(to_email: str, html: str) -> bool:
    """
    Send the digest HTML via Resend.
    Returns True on success, False on failure.
    """
    try:
        response = resend.Emails.send({
            "from": f"{_FROM_NAME} <{_FROM_ADDRESS}>",
            "to": [to_email],
            "subject": "Your Florida Multifamily Deal Digest",
            "html": html,
        })
        return bool(response.get("id"))
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Resend send failed: %s", exc)
        return False
