import json
import re
import time
from google import genai
from google.genai import types

request_timestamps = []
MAX_REQUESTS_PER_MINUTE = 100

# Last provider used by generate_diet_plan (Gemini, fallback); OpenAI is not wired in this app.
LAST_DIET_PLAN_PROVIDER = "unknown"

# Reuse HTTP client across requests (avoids new TLS handshake every call)
_gemini_client = None
_gemini_client_key = None


def _get_gemini_client(api_key: str):
    global _gemini_client, _gemini_client_key
    if not api_key:
        return None
    if _gemini_client is None or _gemini_client_key != api_key:
        _gemini_client = genai.Client(api_key=api_key)
        _gemini_client_key = api_key
    return _gemini_client


def _parse_json_response(text):
    """Strip markdown code blocks, extract JSON object, and parse."""
    text = text.strip()
    # Remove ```json and ``` if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```\s*$", "", text)
    # Extract substring between first '{' and last '}'
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in response")
    cleaned = text[start : end + 1]
    return json.loads(cleaned)


def _get_fallback_plan(calories):
    return {
        "meals": [
            {"name": "Breakfast", "items": ["Oats", "Milk", "Banana"], "calories": int(calories * 0.3)},
            {"name": "Lunch", "items": ["Rice", "Dal", "Vegetables"], "calories": int(calories * 0.4)},
            {"name": "Dinner", "items": ["Chapati", "Paneer", "Salad"], "calories": int(calories * 0.3)},
        ],
        "note": "Fallback plan (LLM unavailable)",
    }


def _fmt_ctx(val):
    """Stringify profile values for prompts; None and empty collections are safe."""
    if val is None:
        return "(not set)"
    if isinstance(val, (list, tuple, set)):
        return ", ".join(str(x) for x in val) if val else "(none)"
    if isinstance(val, dict):
        return json.dumps(val, default=str)
    return str(val)


def _build_diet_context_block(user_dict: dict) -> str:
    """Structured memory/profile for personalized diet generation."""
    u = user_dict
    return f"""User Profile:
Age: {_fmt_ctx(u.get("age"))}
Weight: {_fmt_ctx(u.get("weight"))}
Height: {_fmt_ctx(u.get("height"))}
Goal: {_fmt_ctx(u.get("goal"))}
Activity Level: {_fmt_ctx(u.get("activity_level"))}

Diet Preferences:
Diet Type: {_fmt_ctx(u.get("diet_type"))}
Preferred Foods: {_fmt_ctx(u.get("preferred_foods"))}
Disliked Foods: {_fmt_ctx(u.get("disliked_foods"))}
Allergies: {_fmt_ctx(u.get("allergies"))}

Fitness:
Type: {_fmt_ctx(u.get("fitness_type"))}
Gym Level: {_fmt_ctx(u.get("gym_level"))}
Sport: {_fmt_ctx(u.get("sport_type"))}
Training Intensity: {_fmt_ctx(u.get("training_intensity"))}

Behavior:
Skipped Meals: {_fmt_ctx(u.get("skipped_meals"))}

Feedback:
Liked Foods: {_fmt_ctx(u.get("high_rated_foods"))}
Avoid Foods: {_fmt_ctx(u.get("low_rated_foods"))}
"""


def generate_diet_plan(user_data, calories, macros):
    global LAST_DIET_PLAN_PROVIDER
    from app.core.config import GEMINI_API_KEY

    memory_section = ""
    context_block = ""
    if isinstance(user_data, dict):
        _skip_profile_keys = frozenset({"food_usage_counts", "feedback_history"})
        slim = {k: v for k, v in user_data.items() if k not in _skip_profile_keys}
        mem = slim.pop("memory_context", None)
        if mem:
            memory_section = f"""
Learned preferences and history (respect these when compatible with calorie and protein targets):
{mem}
"""
        context_block = _build_diet_context_block(slim)
    else:
        context_block = f"User Profile (raw):\n{_fmt_ctx(user_data)}"

    prompt = f"""
You are a professional diet planner.

{context_block}
{memory_section}

Generate a realistic daily meal plan.

Rules:
- match user's goal
- respect diet type
- avoid disliked/allergy foods
- include preferred foods when possible
- adjust for fitness level
- distribute protein properly

Target Calories: {calories}
Target Macros: {macros}

Return STRICT JSON ONLY:
{{
  "meals": [
    {{
      "name": "Breakfast",
      "items": ["food item 1"],
      "calories": 400
    }}
  ]
}}
"""

    now = time.time()
    request_timestamps[:] = [t for t in request_timestamps if now - t < 60]
    if len(request_timestamps) >= MAX_REQUESTS_PER_MINUTE:
        print("RATE LIMIT HIT - using fallback")
        LAST_DIET_PLAN_PROVIDER = "fallback"
        print("[diet_llm] provider=fallback (rate_limit) | OpenAI=not_used")
        return _get_fallback_plan(calories)
    request_timestamps.append(now)

    if not GEMINI_API_KEY:
        print("NO GEMINI API KEY - using fallback")
        LAST_DIET_PLAN_PROVIDER = "fallback"
        print("[diet_llm] provider=fallback (no_api_key) | OpenAI=not_used")
        return _get_fallback_plan(calories)

    safety_settings = [
        types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
    ]
    config = types.GenerateContentConfig(
        temperature=0.3,
        top_p=0.95,
        safety_settings=safety_settings,
    )
    full_prompt = "You generate structured diet plans. " + prompt

    try:
        print("USING GEMINI KEY:", GEMINI_API_KEY[-4:] if GEMINI_API_KEY else "NONE")
        client = _get_gemini_client(GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=full_prompt,
            config=config,
        )
        if not response.text:
            raise ValueError("Gemini returned empty response (possibly blocked)")
        content = response.text
        preview = content[:500] + ("..." if len(content) > 500 else "")
        print("RAW GEMINI RESPONSE (preview):", preview, f"| {len(content)} chars")
        LAST_DIET_PLAN_PROVIDER = "Gemini"
        print("[diet_llm] provider=Gemini | OpenAI=not_used")
        return _parse_json_response(content)
    except Exception as e:
        import traceback

        traceback.print_exc()
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
            print("Gemini quota exceeded. Using fallback. Check: https://ai.dev/rate-limit")
        else:
            print("Gemini error:", e)
        LAST_DIET_PLAN_PROVIDER = "fallback"
        print("[diet_llm] provider=fallback (api_error) | OpenAI=not_used")
        return _get_fallback_plan(calories)


def call_llm(prompt: str):
    """
    General-purpose Gemini call for structured or long-form outputs.
    Returns raw model text (strip) or None on failure / no key.
    Caller is responsible for parsing (e.g. JSON via _parse_json_response).
    """
    from app.core.config import GEMINI_API_KEY

    if not GEMINI_API_KEY:
        return None

    now = time.time()
    request_timestamps[:] = [t for t in request_timestamps if now - t < 60]
    if len(request_timestamps) >= MAX_REQUESTS_PER_MINUTE:
        print("[call_llm] skipped (rate_limit)")
        return None
    request_timestamps.append(now)

    safety_settings = [
        types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
    ]
    config = types.GenerateContentConfig(
        temperature=0.35,
        top_p=0.9,
        max_output_tokens=4096,
        safety_settings=safety_settings,
    )
    full_prompt = (
        "Follow the user's instructions exactly. When JSON is requested, respond with STRICT JSON only, "
        "no markdown fences or commentary.\n\n"
        + prompt
    )

    try:
        client = _get_gemini_client(GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=full_prompt,
            config=config,
        )
        if not response.text:
            return None
        return response.text.strip()
    except Exception as e:
        print("[call_llm] error:", e)
        return None


def call_llm_recommendation(prompt: str):
    """
    Plain-text Gemini call for short diet tips. Returns stripped text or None on failure / no key.
    Shares the same rate-limit bucket as diet generation to avoid runaway usage.
    """
    from app.core.config import GEMINI_API_KEY

    if not GEMINI_API_KEY:
        return None

    now = time.time()
    request_timestamps[:] = [t for t in request_timestamps if now - t < 60]
    if len(request_timestamps) >= MAX_REQUESTS_PER_MINUTE:
        print("[recommendation_llm] skipped (rate_limit)")
        return None
    request_timestamps.append(now)

    safety_settings = [
        types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
        types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
    ]
    config = types.GenerateContentConfig(
        temperature=0.4,
        top_p=0.9,
        max_output_tokens=384,
        safety_settings=safety_settings,
    )
    full_prompt = (
        "You are a supportive nutrition coach. Reply with plain text only, no JSON. "
        + prompt
    )

    try:
        client = _get_gemini_client(GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=full_prompt,
            config=config,
        )
        if not response.text:
            return None
        return response.text.strip()
    except Exception as e:
        print("[recommendation_llm] error:", e)
        return None