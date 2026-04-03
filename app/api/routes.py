from typing import Any, Optional, Tuple

from fastapi import APIRouter, Request

from app.core.auth import get_current_user
from app.agents.orchestrator import Orchestrator
from app.agents.workout_planner import WorkoutPlannerAgent
from app.services.memory import (
    get_user_data,
    get_onboarding_status,
    normalize_user_memory,
    build_memory_context,
    persist_after_generation,
    store_user_data,
    store_feedback,
)
from app.schemas.diet import UserInput, FeedbackInput
from app.schemas.onboarding import OnboardingStepInput, OnboardingInput
from app.services.calculator import (
    calculate_bmr,
    calculate_tdee,
    calculate_target_calories,
    calculate_macros,
)

router = APIRouter()

orchestrator = Orchestrator()
_workout_agent = WorkoutPlannerAgent()


@router.post("/onboard")
def onboard(request: Request, body: OnboardingInput):
    user_id = get_current_user(request)
    patch = body.model_dump(exclude_none=True)
    patch["onboarding_complete"] = True
    store_user_data(user_id, patch, merge_lists=True)
    return {"ok": True, "stored_keys": list(patch.keys())}


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


@router.post("/generate-diet")
def generate_diet(request: Request, user: UserInput):
    user_id = get_current_user(request)
    return _run_diet_generation(user_id, user)


@router.post("/generate-full-plan")
def generate_full_plan(request: Request, user: UserInput):
    user_id = get_current_user(request)
    prep = _prepare_diet_inputs(user_id, user)
    diet_out = _run_diet_generation(user_id, user, prepared=prep)

    try:
        workout_out = _workout_agent.run(prep[0])
    except Exception:
        workout_out = _workout_agent._fallback_output()

    return {"diet": diet_out, "workout": workout_out}
