def normalize(text: str) -> str:
    return text.lower().strip()


MEAL_KEYWORDS = {
    "breakfast": ["breakfast", "morning"],
    "lunch": ["lunch", "afternoon"],
    "dinner": ["dinner", "night"],
}

_SKIP_TOKENS = ("skip", "skipped", "missed")


def _planned_meal_categories(meal_name: str) -> list[str]:
    """Which MEAL_KEYWORDS groups apply to this planned meal name."""
    n = normalize(meal_name)
    out: list[str] = []
    for cat, kws in MEAL_KEYWORDS.items():
        if any(kw in n for kw in kws):
            out.append(cat)
    return out


def _contains_skip(s: str) -> bool:
    n = normalize(s)
    return any(tok in n for tok in _SKIP_TOKENS)


def _keyword_match(actual_norm: str, meal_name: str) -> bool:
    """Actual string mentions a keyword that belongs to the same group as the planned meal."""
    meal_cats = _planned_meal_categories(meal_name)
    for cat in meal_cats:
        for kw in MEAL_KEYWORDS[cat]:
            if kw in actual_norm:
                return True
    return False


def _substring_match(actual_norm: str, meal_name: str) -> bool:
    meal_norm = normalize(meal_name)
    if not meal_norm:
        return False
    return meal_norm in actual_norm


class TrackerAgent:
    def run(self, planned_meals, actual_meals):
        if not planned_meals:
            return {
                "adherence": 0.0,
                "completed": 0,
                "total": 0,
            }

        actual_list = [normalize(str(a)) for a in (actual_meals or []) if str(a).strip()]

        total_planned = len(planned_meals)
        matched_indices: set[int] = set()
        total_completed = 0

        for idx, meal in enumerate(planned_meals):
            if idx in matched_indices:
                continue
            name = meal.get("name") or ""
            for actual in actual_list:
                if _contains_skip(actual):
                    continue

                if _keyword_match(actual, name):
                    matched_indices.add(idx)
                    total_completed += 1
                    break

                if _substring_match(actual, name):
                    matched_indices.add(idx)
                    total_completed += 1
                    break

        adherence = (total_completed / max(total_planned, 1)) * 100

        return {
            "adherence": round(adherence, 2),
            "completed": total_completed,
            "total": total_planned,
        }
