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


def generate_diet_plan(user_data, calories, macros):
    global LAST_DIET_PLAN_PROVIDER
    from app.core.config import GEMINI_API_KEY

    memory_section = ""
    user_details = user_data
    if isinstance(user_data, dict):
        _skip_profile_keys = frozenset({"food_usage_counts", "feedback_history"})
        slim = {k: v for k, v in user_data.items() if k not in _skip_profile_keys}
        mem = slim.pop("memory_context", None)
        if mem:
            memory_section = f"""
Learned preferences and history (respect these when compatible with calorie and protein targets):
{mem}
"""
        try:
            user_details = json.dumps(slim, indent=2, default=str)
        except TypeError:
            user_details = str(slim)
    else:
        user_details = str(user_data)

    prompt = f"""
You are a professional dietitian.

Create a 1-day diet plan.

User profile and current intake:
{user_details}
{memory_section}
Prefer foods listed as preferred when they fit the targets. Do not include foods the user avoids.
Align choices with the stated diet type and goal.

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