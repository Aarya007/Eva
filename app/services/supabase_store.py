"""Load/save nested user state via Supabase PostgREST (eva_user_state). Server-only.

Uses httpx + REST instead of supabase-py to avoid heavy transitive deps on some platforms.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import EVA_DEBUG_SUPABASE, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

logger = logging.getLogger(__name__)


def _truncate_debug(s: str, max_len: int = 2000) -> str:
    if len(s) <= max_len:
        return s
    return f"{s[:max_len]}... [truncated]"


def _debug_supabase(
    op: str,
    user_id: str,
    url: str,
    payload: Any,
    r: httpx.Response,
) -> None:
    """Gated stdout debug for PostgREST calls (EVA_DEBUG_SUPABASE=1). Never log API keys."""
    if not EVA_DEBUG_SUPABASE:
        return
    pl = ""
    if payload is not None:
        try:
            pl = json.dumps(payload, default=str) if isinstance(payload, (dict, list)) else str(payload)
        except (TypeError, ValueError):
            pl = str(payload)
    pl = _truncate_debug(pl, 800)
    print(f"[eva supabase debug] OP={op}", flush=True)
    print(f"USER_ID: {user_id}", flush=True)
    print(f"URL: {url}", flush=True)
    print(f"PAYLOAD: {pl}", flush=True)
    print(f"SUPABASE STATUS: {r.status_code}", flush=True)
    print(f"SUPABASE RESPONSE: {_truncate_debug(r.text)}", flush=True)


class SupabasePersistError(Exception):
    """PostgREST write failed (eva_user_state / eva_onboarding). Log response_text server-side."""

    def __init__(self, message: str, response_text: str = "") -> None:
        self.response_text = response_text
        super().__init__(message)


class SupabaseQueryError(Exception):
    """PostgREST read failed (plan fetch). Log response_text server-side."""

    def __init__(self, message: str, response_text: str = "") -> None:
        self.response_text = response_text
        super().__init__(message)


if SUPABASE_SERVICE_ROLE_KEY:
    print(
        f"[eva] Supabase service role key prefix: {SUPABASE_SERVICE_ROLE_KEY[:10]}",
        flush=True,
    )

_TABLE = "eva_user_state"
_ONBOARDING_TABLE = "eva_onboarding"
_DIET_PLANS_TABLE = "diet_plans"
_WORKOUT_PLANS_TABLE = "workout_plans"
_TIMEOUT = 30.0


def _post_json_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=minimal",
    }

# Must match public.eva_onboarding (supabase/eva_onboarding.sql). Onboarding / health-adjacent data:
# change the DDL and this set together, or PostgREST upserts will fail or drop fields.
_ONBOARDING_COLUMNS = frozenset(
    {
        "onboarding_complete",
        "age",
        "weight",
        "height",
        "gender",
        "medical_none_ack",
        "medical_conditions",
        "medications",
        "sleep_hours",
        "stress_level",
        "work_schedule",
        "diet_type",
        "allergies",
        "preferred_foods",
        "disliked_foods",
        "goal",
        "activity_level",
        "target_weight_kg",
        "goal_timeline_weeks",
        "measurements_na",
        "waist_cm",
        "body_fat_pct",
        "fitness_type",
        "gym_level",
        "sport_type",
        "training_intensity",
        "training_environment",
        "display_name",
        "timezone",
    }
)


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
        _debug_supabase("fetch_nested_state", user_id, url, params, r)
        if r.status_code != 200:
            logger.warning(
                "fetch_nested_state GET %s: status=%s body=%s",
                user_id,
                r.status_code,
                r.text,
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
        _debug_supabase("upsert_nested_state", user_id, url, payload, r)
        if r.status_code not in (200, 201, 204):
            logger.error(
                "upsert_nested_state POST %s: status=%s body=%s",
                user_id,
                r.status_code,
                r.text,
            )
            raise SupabasePersistError(
                f"eva_user_state upsert failed: HTTP {r.status_code}",
                r.text,
            )
    except SupabasePersistError:
        raise
    except Exception as e:
        logger.exception("upsert_nested_state failed for %s", user_id)
        raise SupabasePersistError(str(e), "") from e


def _onboarding_row_from_flat(user_id: str, flat: dict[str, Any]) -> dict[str, Any]:
    """Map normalized memory flat dict to eva_onboarding JSON payload."""
    row: dict[str, Any] = {"user_id": user_id}
    row["onboarding_complete"] = bool(flat.get("onboarding_complete", False))
    row["medical_none_ack"] = bool(flat.get("medical_none_ack", False))
    row["measurements_na"] = bool(flat.get("measurements_na", False))
    for k in _ONBOARDING_COLUMNS:
        if k in (
            "onboarding_complete",
            "medical_none_ack",
            "measurements_na",
        ):
            continue
        v = flat.get(k)
        if k in (
            "allergies",
            "preferred_foods",
            "disliked_foods",
            "medical_conditions",
            "medications",
        ):
            row[k] = list(v) if isinstance(v, list) else None
        else:
            row[k] = v
    return row


def upsert_onboarding_snapshot(user_id: str, flat: dict[str, Any]) -> None:
    """Upsert one row in public.eva_onboarding from merged flat memory (sensitive profile snapshot)."""
    if not is_persistence_enabled():
        return
    base = SUPABASE_URL.rstrip("/")
    url = f"{base}/rest/v1/{_ONBOARDING_TABLE}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    payload = _onboarding_row_from_flat(user_id, flat)
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(url, headers=headers, json=payload)
        _debug_supabase("upsert_onboarding_snapshot", user_id, url, payload, r)
        if r.status_code not in (200, 201, 204):
            logger.error(
                "upsert_onboarding_snapshot POST %s: status=%s body=%s",
                user_id,
                r.status_code,
                r.text,
            )
            raise SupabasePersistError(
                f"eva_onboarding upsert failed HTTP {r.status_code}",
                r.text,
            )
    except SupabasePersistError:
        raise
    except Exception as e:
        logger.exception("upsert_onboarding_snapshot failed for %s", user_id)
        raise SupabasePersistError("eva_onboarding upsert failed", str(e)) from e


def insert_diet_plan(user_id: str, plan: dict[str, Any]) -> None:
    """Insert a diet plan row. Raises RuntimeError on PostgREST failure (caller surfaces 503/warnings)."""
    if not is_persistence_enabled():
        raise RuntimeError("Supabase persistence is not configured")
    base = SUPABASE_URL.rstrip("/")
    url = f"{base}/rest/v1/{_DIET_PLANS_TABLE}"
    payload = {"user_id": user_id, "plan": plan}
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(url, headers=_post_json_headers(), json=payload)
        _debug_supabase("insert_diet_plan", user_id, url, payload, r)
        if r.status_code not in (200, 201, 204):
            logger.error(
                "insert_diet_plan POST user=%s status=%s body=%s",
                user_id,
                r.status_code,
                r.text,
            )
            raise RuntimeError(
                f"diet_plans insert failed: HTTP {r.status_code} {r.text}"
            )
    except RuntimeError:
        raise
    except Exception as e:
        logger.exception("insert_diet_plan failed for %s", user_id)
        raise RuntimeError(str(e)) from e


def insert_workout_plan(user_id: str, plan: dict[str, Any]) -> None:
    """Insert a workout plan row. Raises RuntimeError on PostgREST failure."""
    if not is_persistence_enabled():
        raise RuntimeError("Supabase persistence is not configured")
    base = SUPABASE_URL.rstrip("/")
    url = f"{base}/rest/v1/{_WORKOUT_PLANS_TABLE}"
    payload = {"user_id": user_id, "plan": plan}
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(url, headers=_post_json_headers(), json=payload)
        _debug_supabase("insert_workout_plan", user_id, url, payload, r)
        if r.status_code not in (200, 201, 204):
            logger.error(
                "insert_workout_plan POST user=%s status=%s body=%s",
                user_id,
                r.status_code,
                r.text,
            )
            raise RuntimeError(
                f"workout_plans insert failed: HTTP {r.status_code} {r.text}"
            )
    except RuntimeError:
        raise
    except Exception as e:
        logger.exception("insert_workout_plan failed for %s", user_id)
        raise RuntimeError(str(e)) from e


def fetch_latest_diet_plan(user_id: str) -> dict[str, Any] | None:
    """Latest diet plan for user: {"plan": dict, "created_at": str} or None."""
    if not is_persistence_enabled():
        return None
    base = SUPABASE_URL.rstrip("/")
    url = f"{base}/rest/v1/{_DIET_PLANS_TABLE}"
    params = {
        "user_id": f"eq.{user_id}",
        "select": "plan,created_at",
        "order": "created_at.desc",
        "limit": "1",
    }
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.get(url, params=params, headers=_headers_json())
        _debug_supabase("fetch_latest_diet_plan", user_id, url, params, r)
        if r.status_code != 200:
            logger.error(
                "fetch_latest_diet_plan GET user=%s status=%s body=%s",
                user_id,
                r.status_code,
                r.text,
            )
            raise SupabaseQueryError(
                f"diet_plans fetch failed HTTP {r.status_code}",
                r.text,
            )
        rows = r.json()
        if not rows:
            return None
        row = rows[0]
        plan = row.get("plan")
        if not isinstance(plan, dict):
            return None
        ca = row.get("created_at")
        return {
            "plan": plan,
            "created_at": ca if isinstance(ca, str) else "",
        }
    except SupabaseQueryError:
        raise
    except Exception as e:
        logger.exception("fetch_latest_diet_plan failed for %s", user_id)
        raise SupabaseQueryError("diet_plans fetch failed", str(e)) from e


def fetch_latest_workout_plan(user_id: str) -> dict[str, Any] | None:
    """Latest workout plan for user: {"plan": dict, "created_at": str} or None."""
    if not is_persistence_enabled():
        return None
    base = SUPABASE_URL.rstrip("/")
    url = f"{base}/rest/v1/{_WORKOUT_PLANS_TABLE}"
    params = {
        "user_id": f"eq.{user_id}",
        "select": "plan,created_at",
        "order": "created_at.desc",
        "limit": "1",
    }
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.get(url, params=params, headers=_headers_json())
        _debug_supabase("fetch_latest_workout_plan", user_id, url, params, r)
        if r.status_code != 200:
            logger.error(
                "fetch_latest_workout_plan GET user=%s status=%s body=%s",
                user_id,
                r.status_code,
                r.text,
            )
            raise SupabaseQueryError(
                f"workout_plans fetch failed HTTP {r.status_code}",
                r.text,
            )
        rows = r.json()
        if not rows:
            return None
        row = rows[0]
        plan = row.get("plan")
        if not isinstance(plan, dict):
            return None
        ca = row.get("created_at")
        return {
            "plan": plan,
            "created_at": ca if isinstance(ca, str) else "",
        }
    except SupabaseQueryError:
        raise
    except Exception as e:
        logger.exception("fetch_latest_workout_plan failed for %s", user_id)
        raise SupabaseQueryError("workout_plans fetch failed", str(e)) from e
