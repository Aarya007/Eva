import logging
from datetime import datetime, timezone
from typing import Any, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Request

from core.auth import get_current_user
from agents.orchestrator import Orchestrator
from agents.tracker_agent import TrackerAgent
from agents.workout_planner import WorkoutPlannerAgent
from services.memory import (
    get_user_data,
    get_onboarding_status,
    normalize_user_memory,
    build_memory_context,
    persist_after_generation,
    store_user_data,
    store_feedback,
    profile_ready,
)
from schemas.diet import UserInput, FeedbackInput
from schemas.onboarding import OnboardingStepInput, OnboardingInput
from schemas.track import TrackInput
from services.calculator import (
    calculate_bmr,
    calculate_tdee,
    calculate_target_calories,
    calculate_macros,
)
from services.supabase_store import (
    SupabaseQueryError,
    fetch_latest_diet_plan,
    fetch_latest_workout_plan,
    insert_diet_plan,
    insert_workout_plan,
    is_persistence_enabled,
)

router = APIRouter()
logger = logging.getLogger(__name__)

orchestrator = Orchestrator()
_workout_agent = WorkoutPlannerAgent()
_tracker_agent = TrackerAgent()


def _apply_full_onboarding(user_id: str, body: OnboardingInput) -> dict:
    patch = body.model_dump(exclude_none=True)
    patch["onboarding_complete"] = True
    store_user_data(user_id, patch, merge_lists=True)
    return {
        "ok": True,
        "stored_keys": list(patch.keys()),
        "profile": normalize_user_memory(get_user_data(user_id)),
    }


@router.post("/onboard")
def onboard(request: Request, body: OnboardingInput):
    user_id = get_current_user(request)
    return _apply_full_onboarding(user_id, body)


@router.post("/onboarding")
def onboarding_post(request: Request, body: OnboardingInput):
    user_id = get_current_user(request)
    return _apply_full_onboarding(user_id, body)


@router.post("/onboarding/step")
def onboarding_step(request: Request, body: OnboardingStepInput):
    user_id = get_current_user(request)
    patch = body.model_dump(exclude_none=True)
    store_user_data(user_id, patch, merge_lists=True)
    return {"ok": True, "stored_keys": list(patch.keys())}


@router.get("/onboarding/status")
def onboarding_status(request: Request):
    user_id = get_current_user(request)
    return get_onboarding_status(user_id)


@router.get("/profile")
def get_profile(request: Request):
    user_id = get_current_user(request)
    st = get_onboarding_status(user_id)
    return {
        "profile": normalize_user_memory(get_user_data(user_id)),
        "onboarding_complete": st["onboarding_complete"],
        "completion_percent": st["completion_percent"],
        "filled": st["filled"],
    }


@router.post("/onboarding/complete")
def onboarding_complete(request: Request):
    user_id = get_current_user(request)
    store_user_data(user_id, {"onboarding_complete": True})
    return {"ok": True, "onboarding_complete": True}


@router.post("/feedback")
def submit_feedback(request: Request, body: FeedbackInput):
    user_id = get_current_user(request)
    store_feedback(
        user_id,
        body.rating,
        body.feedback_text or "",
        body.plan,
    )
    return {"ok": True}


def _prepare_diet_inputs(user_id: str, user: UserInput):
    past_data = normalize_user_memory(get_user_data(user_id))
    user_dict = user.model_dump(exclude_none=True)
    if user_dict.get("skipped_meals"):
        store_user_data(
            user_id,
            {"skipped_meals": user_dict["skipped_meals"]},
            merge_lists=True,
        )
        past_data = normalize_user_memory(get_user_data(user_id))
    combined_input = {**past_data, **user_dict}
    combined_input["memory_context"] = build_memory_context(combined_input)
    planner_input = {k: v for k, v in combined_input.items() if k != "actual_meals"}

    bmr = calculate_bmr(user.weight, user.height, user.age, user.gender)
    tdee = calculate_tdee(bmr, user.activity_level)
    calories = calculate_target_calories(tdee, user.goal)
    macros = calculate_macros(calories, user.weight)
    return planner_input, calories, macros, user_dict


PreparedDietInputs = Tuple[Any, float, dict, dict]


def _run_diet_generation(
    user_id: str,
    user: UserInput,
    prepared: Optional[PreparedDietInputs] = None,
) -> dict:
    if prepared is None:
        planner_input, calories, macros, _user_dict = _prepare_diet_inputs(user_id, user)
    else:
        planner_input, calories, macros, _user_dict = prepared

    try:
        result = orchestrator.run(
            planner_input,
            calories,
            macros,
            actual_meals=user.actual_meals,
        )
    except Exception as e:
        logger.exception("orchestrator.run failed for user_id=%s", user_id)
        return {"error": str(e)}

    if "error" in result:
        return {
            "target_calories": round(calories),
            "macros": macros,
            "error": result.get("error"),
            "details": result.get("details"),
        }

    if result.get("validation", {}).get("status") == "valid":
        persist_after_generation(
            user_id,
            user.model_dump(exclude_none=True),
            result["plan"],
            last_calories=round(calories),
        )

    out = {
        "target_calories": round(calories),
        "macros": macros,
        "validation": result["validation"],
        "plan": result["plan"],
    }
    if result.get("adaptation"):
        out["adaptation"] = result["adaptation"]
    if result.get("adherence"):
        out["adherence"] = result["adherence"]
    if result.get("recommendations"):
        out["recommendations"] = result["recommendations"]
    return out


def _persist_plans_after_full(
    user_id: str, diet_out: dict, workout_out: dict
) -> List[str]:
    warnings: List[str] = []
    if not is_persistence_enabled():
        warnings.append("Supabase not configured; plans not persisted to database")
        return warnings

    diet_plan = diet_out.get("plan")
    diet_ok = (
        "error" not in diet_out
        and diet_out.get("validation", {}).get("status") == "valid"
        and isinstance(diet_plan, dict)
    )
    if diet_ok:
        try:
            insert_diet_plan(user_id, diet_plan)
        except RuntimeError as e:
            logger.error("insert_diet_plan failed: %s", e)
            warnings.append(f"diet_plan_not_persisted: {e}")
    elif "error" not in diet_out:
        warnings.append("diet_plan_not_persisted: diet validation not valid")

    try:
        insert_workout_plan(user_id, workout_out)
    except RuntimeError as e:
        logger.error("insert_workout_plan failed: %s", e)
        warnings.append(f"workout_plan_not_persisted: {e}")

    return warnings


def _combine_track_inputs(body: TrackInput) -> list[str]:
    out: list[str] = []
    for x in body.actual_meals or []:
        if isinstance(x, str) and x.strip():
            out.append(x.strip())
    if body.notes:
        for x in body.notes:
            if isinstance(x, str) and x.strip():
                out.append(x.strip())
    return out


@router.post("/generate-diet")
def generate_diet(request: Request, user: UserInput):
    user_id = get_current_user(request)
    if not profile_ready(user_id):
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    return _run_diet_generation(user_id, user)


@router.post("/generate-full-plan")
def generate_full_plan(request: Request, user: UserInput):
    user_id = get_current_user(request)
    if not profile_ready(user_id):
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    prep = _prepare_diet_inputs(user_id, user)
    diet_out = _run_diet_generation(user_id, user, prepared=prep)

    try:
        workout_out = _workout_agent.run(prep[0])
    except Exception:
        logger.exception("generate_full_plan: workout agent failed")
        workout_out = _workout_agent._fallback_output()

    warnings = _persist_plans_after_full(user_id, diet_out, workout_out)
    out: dict[str, Any] = {"diet": diet_out, "workout": workout_out}
    if warnings:
        out["warnings"] = warnings
    return out


@router.get("/plans")
def get_plans(request: Request):
    user_id = get_current_user(request)
    try:
        diet = fetch_latest_diet_plan(user_id)
        workout = fetch_latest_workout_plan(user_id)
    except SupabaseQueryError:
        raise HTTPException(status_code=503, detail="Failed to fetch plans")
    status = "empty" if diet is None and workout is None else "ok"
    return {"diet": diet, "workout": workout, "status": status}


@router.post("/track")
def track(request: Request, body: TrackInput):
    user_id = get_current_user(request)
    actual = _combine_track_inputs(body)
    try:
        latest = fetch_latest_diet_plan(user_id)
    except SupabaseQueryError:
        raise HTTPException(status_code=503, detail="Failed to fetch plans")
    if not latest or not isinstance(latest.get("plan"), dict):
        raise HTTPException(
            status_code=400,
            detail="No saved diet plan found. Generate a full plan first.",
        )
    meals = latest["plan"].get("meals")
    if not isinstance(meals, list) or not meals:
        raise HTTPException(
            status_code=400,
            detail="Saved diet plan has no meals; generate a full plan again.",
        )
    result = _tracker_agent.run(meals, actual)
    ts = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    store_user_data(
        user_id,
        {
            "last_tracker_adherence": result.get("adherence"),
            "last_tracker_at": ts,
        },
    )
    return {"ok": True, "adherence": result}