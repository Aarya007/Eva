from app.core.config import EVA_DEBUG_AUTH
from app.services.supabase_store import (
    fetch_nested_state,
    is_persistence_enabled,
    upsert_nested_state,
    upsert_onboarding_snapshot,
)

user_memory = {}


def _debug(msg: str) -> None:
    if EVA_DEBUG_AUTH:
        print(f"[eva debug] {msg}", flush=True)

PREFERRED_TOP_N = 15

# Top-level sections per user (aligned with onboarding / agent concerns)
SECTION_KEYS = (
    "basic_info",
    "goals",
    "medical",
    "lifestyle",
    "diet",
    "measurements",
    "fitness",
    "personalization",
    "behavior",
    "feedback",
)

# Single source of truth: flat field name -> section
FIELD_TO_SECTION = {
    "age": "basic_info",
    "weight": "basic_info",
    "height": "basic_info",
    "gender": "basic_info",
    "onboarding_complete": "basic_info",
    "goal": "goals",
    "activity_level": "goals",
    "target_weight_kg": "goals",
    "goal_timeline_weeks": "goals",
    "medical_none_ack": "medical",
    "medical_conditions": "medical",
    "medications": "medical",
    "sleep_hours": "lifestyle",
    "stress_level": "lifestyle",
    "work_schedule": "lifestyle",
    "diet_type": "diet",
    "allergies": "diet",
    "preferred_foods": "diet",
    "disliked_foods": "diet",
    "measurements_na": "measurements",
    "waist_cm": "measurements",
    "body_fat_pct": "measurements",
    "fitness_type": "fitness",
    "gym_level": "fitness",
    "sport_type": "fitness",
    "training_intensity": "fitness",
    "training_environment": "fitness",
    "display_name": "personalization",
    "timezone": "personalization",
    "skipped_meals": "behavior",
    "food_usage_counts": "behavior",
    "last_plan_summary": "behavior",
    "last_calories": "behavior",
    "last_tracker_adherence": "behavior",
    "last_tracker_at": "behavior",
    "feedback_history": "feedback",
    "low_rated_foods": "feedback",
    "high_rated_foods": "feedback",
}

MERGE_LIST_KEYS = (
    "preferred_foods",
    "disliked_foods",
    "allergies",
    "skipped_meals",
    "medical_conditions",
    "medications",
)

DEFAULT_MEMORY = {
    "preferred_foods": [],
    "disliked_foods": [],
    "allergies": [],
    "skipped_meals": [],
    "medical_conditions": [],
    "medications": [],
    "feedback_history": [],
    "low_rated_foods": [],
    "high_rated_foods": [],
    "diet_type": "",
    "goal": "",
    "age": None,
    "weight": None,
    "height": None,
    "gender": "",
    "activity_level": "",
    "fitness_type": None,
    "gym_level": None,
    "sport_type": None,
    "training_intensity": None,
    "training_environment": None,
    "onboarding_complete": False,
    "last_plan_summary": "",
    "food_usage_counts": {},
    "last_calories": None,
    "medical_none_ack": False,
    "sleep_hours": None,
    "stress_level": "",
    "work_schedule": "",
    "measurements_na": False,
    "waist_cm": None,
    "body_fat_pct": None,
    "target_weight_kg": None,
    "goal_timeline_weeks": None,
    "display_name": "",
    "timezone": "",
    "last_tracker_adherence": None,
    "last_tracker_at": "",
}

# Virtual keys use prefixes __step_ for completion % only
ONBOARDING_TRACKED_KEYS = (
    "age",
    "weight",
    "height",
    "gender",
    "__step_medical",
    "sleep_hours",
    "stress_level",
    "work_schedule",
    "diet_type",
    "goal",
    "activity_level",
    "__step_measurements",
    "__step_fitness",
)


def _empty_nested_user() -> dict:
    return {k: {} for k in SECTION_KEYS}


def _is_nested_row(row: dict) -> bool:
    return isinstance(row, dict) and all(
        k in row and isinstance(row[k], dict) for k in SECTION_KEYS
    )


def _migrate_legacy_to_nested(row: dict) -> dict:
    """Convert legacy flat or mixed storage into sectioned structure."""
    out = _empty_nested_user()
    for sec in SECTION_KEYS:
        if sec in row and isinstance(row[sec], dict):
            out[sec].update(row[sec])
    for k, v in row.items():
        if k in SECTION_KEYS:
            continue
        sec = FIELD_TO_SECTION.get(k)
        if sec:
            out[sec][k] = v
    return out


def _nested_from_persisted(raw: dict) -> dict:
    """Deserialize JSONB state from Supabase into nested section dict."""
    if not raw:
        return _empty_nested_user()
    if _is_nested_row(raw):
        return raw
    return _migrate_legacy_to_nested(raw)


def _persist_user_state(user_id: str) -> None:
    if not is_persistence_enabled():
        return
    if user_id not in user_memory:
        return
    nested = user_memory[user_id]
    upsert_nested_state(user_id, nested)
    upsert_onboarding_snapshot(user_id, flatten_user_record(nested))


def flatten_user_record(nested: dict) -> dict:
    """Merge sections into one flat dict for agents and normalize_user_memory."""
    flat: dict = {}
    for sec in SECTION_KEYS:
        part = nested.get(sec)
        if isinstance(part, dict):
            flat.update(part)
    return flat


def _ensure_nested(user_id: str) -> None:
    if user_id not in user_memory:
        loaded = None
        if is_persistence_enabled():
            raw = fetch_nested_state(user_id)
            if raw is not None:
                loaded = _nested_from_persisted(raw)
        if loaded is not None:
            user_memory[user_id] = loaded
            _debug(
                f"memory: loaded user_id={user_id} from persistence "
                f"(sections={list(loaded.keys())})"
            )
        else:
            user_memory[user_id] = _empty_nested_user()
            _debug(
                f"memory: new in-process user_id={user_id} "
                f"(no row yet or persistence disabled={not is_persistence_enabled()})"
            )
        return
    row = user_memory[user_id]
    if _is_nested_row(row):
        return
    if not row:
        user_memory[user_id] = _empty_nested_user()
        return
    user_memory[user_id] = _migrate_legacy_to_nested(row)


def _norm_food(s: str) -> str:
    return (s or "").strip().lower()


def dedupe_merge_lists(a, b):
    seen = set()
    out = []
    for x in (a or []) + (b or []):
        if not isinstance(x, str):
            continue
        raw = x.strip()
        k = _norm_food(raw)
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(raw)
    return out


def normalize_user_memory(d: dict) -> dict:
    base = {**DEFAULT_MEMORY, **(d or {})}
    for k in (
        "preferred_foods",
        "disliked_foods",
        "allergies",
        "skipped_meals",
        "medical_conditions",
        "medications",
        "low_rated_foods",
        "high_rated_foods",
    ):
        v = base.get(k)
        base[k] = list(v) if isinstance(v, list) else []
    fh = base.get("feedback_history")
    base["feedback_history"] = list(fh) if isinstance(fh, list) else []
    fc = base.get("food_usage_counts")
    base["food_usage_counts"] = dict(fc) if isinstance(fc, dict) else {}
    for kk, vv in list(base["food_usage_counts"].items()):
        if isinstance(kk, str) and isinstance(vv, int):
            continue
        del base["food_usage_counts"][kk]
    base["onboarding_complete"] = bool(base.get("onboarding_complete", False))
    return base


def build_last_plan_summary(plan: dict) -> str:
    lines = []
    for m in plan.get("meals") or []:
        name = m.get("name", "Meal")
        items = [x for x in (m.get("items") or []) if isinstance(x, str)]
        lines.append(f"{name}: {', '.join(items)}")
    return "; ".join(lines)


def build_memory_context(d: dict) -> str:
    prefs = d.get("preferred_foods") or []
    dislike = d.get("disliked_foods") or []
    summary = (d.get("last_plan_summary") or "").strip()
    dt = (d.get("diet_type") or "").strip()
    goal = (d.get("goal") or "").strip()
    parts = []
    if dt:
        parts.append(f"Diet type: {dt}")
    if goal:
        parts.append(f"Goal: {goal}")
    if prefs:
        parts.append("Preferred foods (use often): " + ", ".join(str(p) for p in prefs))
    if dislike:
        parts.append("Avoid these foods: " + ", ".join(str(x) for x in dislike))
    allergies = d.get("allergies") or []
    if allergies:
        parts.append(
            "Allergies (never include): " + ", ".join(str(x) for x in allergies)
        )
    low_fb = d.get("low_rated_foods") or []
    if low_fb:
        parts.append(
            "Avoid (user rated plans with these poorly): "
            + ", ".join(str(x) for x in low_fb)
        )
    high_fb = d.get("high_rated_foods") or []
    if high_fb:
        parts.append(
            "Prioritize (user rated plans with these well): "
            + ", ".join(str(x) for x in high_fb)
        )
    skipped = d.get("skipped_meals") or []
    if skipped:
        parts.append("Often skips these meals: " + ", ".join(str(x) for x in skipped))
    ft = d.get("fitness_type")
    gl = d.get("gym_level")
    st = d.get("sport_type")
    ti = d.get("training_intensity")
    te = d.get("training_environment")
    fitness_bits = []
    if isinstance(ft, str) and ft.strip():
        fitness_bits.append(f"type: {ft.strip()}")
    if isinstance(gl, str) and gl.strip():
        fitness_bits.append(f"gym level: {gl.strip()}")
    if isinstance(st, str) and st.strip():
        fitness_bits.append(f"sport: {st.strip()}")
    if isinstance(ti, str) and ti.strip():
        fitness_bits.append(f"intensity: {ti.strip()}")
    if isinstance(te, str) and te.strip():
        fitness_bits.append(f"training environment: {te.strip()}")
    if fitness_bits:
        parts.append("Fitness: " + "; ".join(fitness_bits))
    if summary:
        parts.append(f"Recent plan summary: {summary}")
    if not parts:
        return "No prior preferences stored yet."
    return "\n".join(parts)


def record_foods_from_plan(user_id: str, plan: dict):
    _ensure_nested(user_id)
    nested = user_memory[user_id]
    diet = nested["diet"]
    beh = nested["behavior"]
    fb = nested["feedback"]
    counts = dict(beh.get("food_usage_counts") or {})
    for m in plan.get("meals") or []:
        for item in m.get("items") or []:
            if isinstance(item, str):
                k = _norm_food(item)
                if k:
                    counts[k] = counts.get(k, 0) + 1
    beh["food_usage_counts"] = counts
    disliked = {_norm_food(x) for x in (diet.get("disliked_foods") or []) if isinstance(x, str)}
    low_rated = {_norm_food(x) for x in (fb.get("low_rated_foods") or []) if isinstance(x, str)}
    allergen = {_norm_food(x) for x in (diet.get("allergies") or []) if isinstance(x, str)}
    ranked = sorted(counts.keys(), key=lambda x: (-counts[x], x))
    preferred = []
    for k in ranked:
        if k in disliked or k in low_rated or k in allergen:
            continue
        preferred.append(k.title())
        if len(preferred) >= PREFERRED_TOP_N:
            break
    diet["preferred_foods"] = preferred
    _persist_user_state(user_id)


def store_user_data(user_id: str, data: dict, merge_lists: bool = False):
    """Merge flat API data into the correct section. Unknown keys are ignored."""
    _ensure_nested(user_id)
    nested = user_memory[user_id]
    flat = flatten_user_record(nested)
    if not merge_lists:
        for k, v in data.items():
            sec = FIELD_TO_SECTION.get(k)
            if not sec:
                continue
            nested[sec][k] = v
        _persist_user_state(user_id)
        _debug(
            f"memory: store user_id={user_id} merge_lists={merge_lists} "
            f"incoming_keys={list(data.keys())}"
        )
        return
    patch = dict(data)
    for key in MERGE_LIST_KEYS:
        if key not in patch:
            continue
        sec = FIELD_TO_SECTION[key]
        incoming = patch.pop(key)
        existing = nested[sec].get(key) or flat.get(key)
        nested[sec][key] = dedupe_merge_lists(existing, incoming)
    for k, v in patch.items():
        sec = FIELD_TO_SECTION.get(k)
        if not sec:
            continue
        nested[sec][k] = v
    _persist_user_state(user_id)
    _debug(
        f"memory: store user_id={user_id} merge_lists={merge_lists} "
        f"incoming_keys={list(data.keys())}"
    )


def foods_from_plan(plan: dict):
    out = []
    for m in plan.get("meals") or []:
        for item in m.get("items") or []:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
    return out


def store_feedback(user_id: str, rating: int, feedback_text: str, plan: dict):
    _ensure_nested(user_id)
    fb = user_memory[user_id]["feedback"]
    hist = list(fb.get("feedback_history") or [])
    text = feedback_text if isinstance(feedback_text, str) else ""
    hist.append(
        {
            "rating": int(rating),
            "feedback_text": text[:2000],
        }
    )
    fb["feedback_history"] = hist
    if not isinstance(plan, dict):
        return
    foods = foods_from_plan(plan)
    if rating <= 2 and foods:
        fb["low_rated_foods"] = dedupe_merge_lists(fb.get("low_rated_foods"), foods)
    if rating >= 4 and foods:
        fb["high_rated_foods"] = dedupe_merge_lists(fb.get("high_rated_foods"), foods)
    _persist_user_state(user_id)


def record_skipped_meal(user_id: str, meal_name: str):
    if not isinstance(meal_name, str) or not meal_name.strip():
        return
    _ensure_nested(user_id)
    beh = user_memory[user_id]["behavior"]
    beh["skipped_meals"] = dedupe_merge_lists(beh.get("skipped_meals"), [meal_name.strip()])
    _persist_user_state(user_id)


def persist_after_generation(user_id: str, user_payload: dict, plan: dict, last_calories=None):
    _ensure_nested(user_id)
    nested = user_memory[user_id]
    goals = nested["goals"]
    diet = nested["diet"]
    beh = nested["behavior"]
    diet["diet_type"] = user_payload.get("diet_type") or diet.get("diet_type", "")
    goals["goal"] = user_payload.get("goal") or goals.get("goal", "")
    if last_calories is not None:
        beh["last_calories"] = last_calories
    beh["last_plan_summary"] = build_last_plan_summary(plan)
    if user_payload.get("disliked_foods"):
        diet["disliked_foods"] = dedupe_merge_lists(
            diet.get("disliked_foods"), user_payload["disliked_foods"]
        )
    record_foods_from_plan(user_id, plan)
    if user_payload.get("preferred_foods"):
        diet["preferred_foods"] = dedupe_merge_lists(
            user_payload["preferred_foods"], diet.get("preferred_foods", [])
        )


def get_user_data(user_id: str) -> dict:
    """Return flattened stored data for user_id (agent-compatible shape)."""
    _ensure_nested(user_id)
    flat = dict(flatten_user_record(user_memory[user_id]))
    _debug(
        f"memory: get user_id={user_id} flat_key_count={len(flat)} "
        f"onboarding_complete={flat.get('onboarding_complete')}"
    )
    return flat


def _medical_step_filled(row: dict) -> bool:
    if row.get("medical_none_ack") is True:
        return True
    c = row.get("medical_conditions") or []
    m = row.get("medications") or []
    return isinstance(c, list) and isinstance(m, list) and (len(c) > 0 or len(m) > 0)


def _measurements_step_filled(row: dict) -> bool:
    if row.get("measurements_na") is True:
        return True
    return row.get("waist_cm") is not None or row.get("body_fat_pct") is not None


def _fitness_step_filled(row: dict) -> bool:
    ft = (row.get("fitness_type") or "").strip()
    if ft not in ("home", "gym", "athlete"):
        return False
    ti = (row.get("training_intensity") or "").strip()
    tz = (row.get("timezone") or "").strip()
    if ft == "home":
        return bool(ti) and bool(tz)
    if ft == "gym":
        gl = (row.get("gym_level") or "").strip()
        return bool(gl) and bool(ti) and bool(tz)
    if ft == "athlete":
        sp = (row.get("sport_type") or "").strip()
        env = (row.get("training_environment") or "").strip()
        return bool(sp) and bool(ti) and env in ("gym", "outside", "both") and bool(tz)
    return False


def _onboarding_field_filled(key: str, row: dict) -> bool:
    if key == "__step_medical":
        return _medical_step_filled(row)
    if key == "__step_measurements":
        return _measurements_step_filled(row)
    if key == "__step_fitness":
        return _fitness_step_filled(row)
    v = row.get(key)
    if key in ("age", "weight", "height", "sleep_hours"):
        return v is not None
    if key in (
        "gender",
        "activity_level",
        "goal",
        "diet_type",
        "stress_level",
        "work_schedule",
        "fitness_type",
        "gym_level",
        "sport_type",
        "training_intensity",
    ):
        return isinstance(v, str) and bool(v.strip())
    if key in ("allergies", "preferred_foods", "disliked_foods"):
        return isinstance(v, list) and len(v) > 0
    return False


def profile_snapshot_for_client(row: dict) -> dict:
    """Subset of normalized memory safe for the dashboard / onboarding UI."""
    keys = (
        "age",
        "weight",
        "height",
        "gender",
        "activity_level",
        "goal",
        "target_weight_kg",
        "goal_timeline_weeks",
        "diet_type",
        "allergies",
        "preferred_foods",
        "disliked_foods",
        "medical_none_ack",
        "medical_conditions",
        "medications",
        "sleep_hours",
        "stress_level",
        "work_schedule",
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
        "skipped_meals",
        "last_calories",
    )
    out: dict = {}
    for k in keys:
        v = row.get(k)
        if k in (
            "allergies",
            "preferred_foods",
            "disliked_foods",
            "skipped_meals",
            "medical_conditions",
            "medications",
        ):
            out[k] = list(v) if isinstance(v, list) else []
        elif k == "last_calories":
            out[k] = int(v) if v is not None else None
        elif k in ("age", "weight", "height", "sleep_hours", "waist_cm", "body_fat_pct", "target_weight_kg"):
            out[k] = v
        elif k in ("medical_none_ack", "measurements_na"):
            out[k] = bool(v) if v is not None else False
        elif k == "goal_timeline_weeks":
            out[k] = int(v) if v is not None else None
        elif v is None:
            out[k] = None
        elif isinstance(v, str):
            out[k] = v
        else:
            out[k] = str(v)
    return out


def get_onboarding_status(user_id: str) -> dict:
    row = normalize_user_memory(get_user_data(user_id))
    filled = {k: _onboarding_field_filled(k, row) for k in ONBOARDING_TRACKED_KEYS}
    n = len(ONBOARDING_TRACKED_KEYS)
    completion_percent = round(100.0 * sum(1 for v in filled.values() if v) / max(n, 1), 1)
    return {
        "filled": filled,
        "completion_percent": completion_percent,
        "onboarding_complete": bool(row.get("onboarding_complete")),
        "profile": profile_snapshot_for_client(row),
    }


def profile_ready(user_id: str) -> bool:
    """True when onboarding is marked complete and all wizard-tracked fields are filled."""
    row = normalize_user_memory(get_user_data(user_id))
    if not row.get("onboarding_complete"):
        return False
    return all(_onboarding_field_filled(k, row) for k in ONBOARDING_TRACKED_KEYS)
