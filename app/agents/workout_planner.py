from app.services.llm import _parse_json_response, call_llm


def _fmt(u, key, default="(not set)"):
    if not isinstance(u, dict):
        return default
    v = u.get(key)
    if v is None or v == "":
        return default
    if isinstance(v, (list, tuple, set)):
        return ", ".join(str(x) for x in v) if v else default
    return str(v)


class WorkoutPlannerAgent:
    """
    Generates structured weekly workout programs via LLM, grounded in onboarding / memory profile.
    """

    def run(self, user_data):
        prompt = self.build_prompt(user_data)
        response = call_llm(prompt)
        return self.parse_output(response)

    def build_prompt(self, user_data):
        u = user_data if isinstance(user_data, dict) else {}
        mem = u.get("memory_context")
        mem_block = ""
        if mem:
            mem_block = f"""
Additional context from prior interactions (respect when compatible with safety and level):
{mem}
"""
        return f"""
You are an expert strength and conditioning coach.

User Profile:
- Goal: {_fmt(u, "goal")}
- Fitness Type: {_fmt(u, "fitness_type")}
- Gym Level: {_fmt(u, "gym_level")}
- Activity Level: {_fmt(u, "activity_level")}
- Training Intensity: {_fmt(u, "training_intensity")}
- Training Environment: {_fmt(u, "training_environment")}
- Sport (if applicable): {_fmt(u, "sport_type")}
- Age: {_fmt(u, "age")}
- Gender: {_fmt(u, "gender")}
- Weight (kg): {_fmt(u, "weight")}
- Diet / constraints note: diet_type={_fmt(u, "diet_type")}, allergies={_fmt(u, "allergies")}
{mem_block}
Design a weekly workout plan.

REQUIREMENTS:

1. Structure:
- 5–7 day plan
- each day must have:
    - focus (e.g. push/pull/legs)
    - exercises (3–6)
    - sets and reps

2. Logic:
- respect user level (beginner/intermediate/advanced)
- align with goal (fat loss / muscle gain / maintenance / performance)
- include rest or recovery days
- avoid overtraining same muscle groups

3. Progression:
- briefly mention how to progress weekly

4. Keep realistic:
- no extreme or unsafe plans

OUTPUT FORMAT (STRICT JSON):

{{
  "weekly_plan": [
    {{
      "day": "Day 1",
      "focus": "Chest + Triceps",
      "exercises": [
        {{"name": "Bench Press", "sets": 4, "reps": "8-10"}},
        {{"name": "Push-ups", "sets": 3, "reps": "12-15"}}
      ]
    }}
  ],
  "progression": "Increase weight gradually each week",
  "notes": "Keep rest between 60-90 seconds"
}}
"""

    def parse_output(self, response):
        if not response:
            return self._fallback_output()
        try:
            return _parse_json_response(response)
        except Exception as e:
            print("[WorkoutPlannerAgent] parse_output:", e)
            return self._fallback_output()

    def _fallback_output(self):
        return {
            "weekly_plan": [
                {
                    "day": "Day 1",
                    "focus": "Full body (light)",
                    "exercises": [
                        {"name": "Bodyweight squat", "sets": 3, "reps": "10-12"},
                        {"name": "Push-up or incline push-up", "sets": 3, "reps": "8-12"},
                        {"name": "Plank", "sets": 3, "reps": "30-45 sec"},
                    ],
                },
                {
                    "day": "Day 2",
                    "focus": "Rest or active recovery",
                    "exercises": [
                        {"name": "Walking or cycling", "sets": 1, "reps": "20-30 min easy"},
                    ],
                },
                {
                    "day": "Day 3",
                    "focus": "Full body (moderate)",
                    "exercises": [
                        {"name": "Goblet squat or leg press", "sets": 3, "reps": "8-10"},
                        {"name": "Dumbbell row", "sets": 3, "reps": "10-12"},
                        {"name": "Overhead press or lateral raise", "sets": 3, "reps": "10-12"},
                    ],
                },
            ],
            "progression": "Add one rep per set or a small load increase weekly when all sets feel easy.",
            "notes": "Fallback plan (LLM unavailable). Adjust volume to your level; stop if pain beyond normal muscle fatigue.",
        }
