import json
import re

from app.services.llm import call_llm_recommendation

_MAX_RECOMMENDATIONS = 5
_PLAN_SNIPPET_LEN = 3500


def _rule_based_recommendations(adherence_data, plan):
    recommendations = []

    if adherence_data.get("adherence", 100) < 70:
        recommendations.append("Try simpler meals to improve consistency")

    total_protein = sum(m.get("protein", 0) for m in plan.get("meals", []))

    if total_protein < 100:
        recommendations.append("Increase protein intake (paneer, eggs, dal)")

    if not recommendations:
        recommendations.append("Great job! Keep following the plan")

    return recommendations


def _plan_text(plan):
    try:
        return json.dumps(plan, indent=2, default=str)[:_PLAN_SNIPPET_LEN]
    except TypeError:
        return str(plan)[:_PLAN_SNIPPET_LEN]


def generate_recommendation_llm(context):
    prompt = f"""
User diet plan:
{context['plan']}

Adherence:
{context['adherence']}

Preferences:
{context.get('preferences')}

Give 2-3 short, practical suggestions to improve diet.
Keep it simple and actionable.
Use one suggestion per line. No numbering required.
"""
    return call_llm_recommendation(prompt)


def _lines_from_llm(text):
    if not text:
        return []
    out = []
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        line = re.sub(r"^[\-\*•]\s*", "", line)
        line = re.sub(r"^\d+\.\s*", "", line)
        if len(line) > 15:
            out.append(line)
    return out[:3]


def _merge_dedupe_cap(rule_items, llm_items):
    seen = set()
    merged = []
    for item in rule_items + llm_items:
        key = item.lower().strip()[:160]
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(item)
        if len(merged) >= _MAX_RECOMMENDATIONS:
            break
    return merged


class RecommenderAgent:
    def run(self, adherence_data, plan):
        rules = _rule_based_recommendations(adherence_data, plan)

        adh_str = json.dumps(adherence_data, default=str)
        prefs = ""
        if isinstance(plan, dict):
            note = plan.get("note")
            if note:
                prefs = str(note)

        context = {
            "plan": _plan_text(plan),
            "adherence": adh_str,
            "preferences": prefs or "(not specified)",
        }

        llm_text = None
        try:
            llm_text = generate_recommendation_llm(context)
        except Exception:
            llm_text = None

        llm_lines = _lines_from_llm(llm_text) if llm_text else []

        if not llm_lines:
            final = rules[:_MAX_RECOMMENDATIONS]
        else:
            final = _merge_dedupe_cap(rules, llm_lines)

        if not final:
            final = ["Great job! Keep following the plan"]

        return {
            "recommendations": final,
        }