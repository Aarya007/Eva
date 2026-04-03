"""Load/save nested user state via Supabase PostgREST (eva_user_state). Server-only.

Uses httpx + REST instead of supabase-py to avoid heavy transitive deps on some platforms.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

logger = logging.getLogger(__name__)

_TABLE = "eva_user_state"
_TIMEOUT = 30.0


def _headers_json() -> dict[str, str]:
    key = SUPABASE_SERVICE_ROLE_KEY
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }


def is_persistence_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def fetch_nested_state(user_id: str) -> dict[str, Any] | None:
    """Return raw state dict from DB, or None if missing / disabled / error."""
    if not is_persistence_enabled():
        return None
    base = SUPABASE_URL.rstrip("/")
    url = f"{base}/rest/v1/{_TABLE}"
    params = {"user_id": f"eq.{user_id}", "select": "state"}
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.get(url, params=params, headers=_headers_json())
        if r.status_code != 200:
            logger.warning(
                "fetch_nested_state GET %s: %s %s", user_id, r.status_code, r.text[:200]
            )
            return None
        rows = r.json()
        if not rows:
            return None
        state = rows[0].get("state")
        if isinstance(state, dict):
            return state
        return None
    except Exception as e:
        logger.warning("fetch_nested_state failed for %s: %s", user_id, e)
        return None


def upsert_nested_state(user_id: str, nested: dict[str, Any]) -> None:
    if not is_persistence_enabled():
        return
    base = SUPABASE_URL.rstrip("/")
    url = f"{base}/rest/v1/{_TABLE}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    payload = {"user_id": user_id, "state": nested}
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(url, headers=headers, json=payload)
        if r.status_code not in (200, 201, 204):
            logger.warning(
                "upsert_nested_state POST %s: %s %s", user_id, r.status_code, r.text[:300]
            )
    except Exception as e:
        logger.warning("upsert_nested_state failed for %s: %s", user_id, e)
