from app.services.llm import generate_diet_plan, LAST_DIET_PLAN_PROVIDER
from app.services.memory import dedupe_merge_lists
from app.services.validator import validate_plan
from app.services.tools import calculate_meal_nutrition

CARB_SOURCES = ["rice", "oats", "chapati"]
PROTEIN_SOURCES = ["paneer", "egg", "dal"]
FILLERS = ["banana", "milk"]
MAX_ITEMS_PER_MEAL = 5
CANDIDATES_PER_ROUND = 3

ADAPTATION_SKIPPED_MEALS_NOTE = "Adjusted plan based on skipped meals"


def _skipped_meal_flags(user_data):
    if not isinstance(user_data, dict):
        return frozenset()
    out = set()
    for x in user_data.get("skipped_meals") or []:
        if not isinstance(x, str):
            continue
        n = x.lower()
        if "breakfast" in n:
            out.add("breakfast")
        if "lunch" in n:
            out.add("lunch")
        if "dinner" in n or "supper" in n:
            out.add("dinner")
    return frozenset(out)


def _meal_target_fractions(user_data):
    """
    Default 30/40/30 breakfast/lunch/dinner. If user often skips a meal,
    lower that slot and shift calories to the others (re-normalized to sum 1).
    """
    b, l, d = 0.3, 0.4, 0.3
    flags = _skipped_meal_flags(user_data)
    if "breakfast" in flags:
        freed = b - 0.15
        b = 0.15
        l += freed * 0.6
        d += freed * 0.4
    if "dinner" in flags:
        freed = d - 0.15
        d = 0.15
        b += freed * 0.55
        l += freed * 0.45
    if "lunch" in flags:
        freed = l - 0.15
        l = 0.15
        b += freed * 0.45
        d += freed * 0.55
    s = b + l + d
    if s <= 0:
        return (0.3, 0.4, 0.3)
    return (b / s, l / s, d / s)


def _norm_item(s):
    return (s or "").strip().lower()


def _effective_food_lists(user_data):
    """
    Order protein/carb/filler sources with preferred foods first, drop disliked.
    If every default protein is disliked, fall back to full defaults so validation can still succeed.
    """
    if not isinstance(user_data, dict):
        return list(PROTEIN_SOURCES), list(CARB_SOURCES), list(FILLERS)

    disliked_list = dedupe_merge_lists(
        dedupe_merge_lists(
            [x for x in (user_data.get("disliked_foods") or []) if isinstance(x, str)],
            [x for x in (user_data.get("low_rated_foods") or []) if isinstance(x, str)],
        ),
        [x for x in (user_data.get("allergies") or []) if isinstance(x, str)],
    )
    disliked = {_norm_item(x) for x in disliked_list}
    high_list = [
        x.strip()
        for x in (user_data.get("high_rated_foods") or [])
        if isinstance(x, str) and x.strip()
    ]
    pref_list = [
        x.strip()
        for x in (user_data.get("preferred_foods") or [])
        if isinstance(x, str) and x.strip()
    ]
    preferred_raw = dedupe_merge_lists(high_list, pref_list)

    def build_category(defaults):
        picked = []
        seen = set()
        for pr in preferred_raw:
            pn = _norm_item(pr)
            if pn in disliked or pn in seen:
                continue
            if any(pn == d.lower() or pn in d or d in pn for d in defaults):
                picked.append(pr)
                seen.add(pn)
        for d in defaults:
            dn = d.lower()
            if dn in disliked or dn in seen:
                continue
            picked.append(d)
            seen.add(dn)
        if not picked:
            picked = [d for d in defaults if d.lower() not in disliked] or list(defaults)
        return picked

    proteins = build_category(PROTEIN_SOURCES)
    carbs = build_category(CARB_SOURCES)
    fillers = build_category(FILLERS)

    all_defaults_lower = {d.lower() for d in PROTEIN_SOURCES + CARB_SOURCES + FILLERS}
    seen_p = {_norm_item(p) for p in proteins}
    for pr in preferred_raw:
        pn = _norm_item(pr)
        if pn in disliked or pn in seen_p or pn in all_defaults_lower:
            continue
        proteins.append(pr)
        seen_p.add(pn)

    return proteins, carbs, fillers


def _normalize_meal(meal, proteins, carbs, fillers):
    items = list(meal.get("items", []))
    seen = set()
    items = [x for x in items if x.lower() not in seen and not seen.add(x.lower())]
    items_lower = [x.lower() for x in items]
    protein_lower = {p.lower() for p in proteins}
    carb_lower = {c.lower() for c in carbs}
    filler_lower = {f.lower() for f in fillers}

    if not any(p in items_lower for p in protein_lower):
        for p in proteins:
            if p.lower() not in items_lower:
                items.append(p)
                items_lower.append(p.lower())
                break

    if not any(c in items_lower for c in carb_lower):
        name = meal.get("name", "").lower()
        pick = None
        if "breakfast" in name:
            pick = next((c for c in carbs if c.lower() == "oats"), None) or (carbs[0] if carbs else "oats")
        else:
            pick = next((c for c in carbs if c.lower() == "rice"), None) or (carbs[0] if carbs else "rice")
        items.append(pick)
        items_lower.append(pick.lower())

    while len(items) > MAX_ITEMS_PER_MEAL:
        drop_idx = next((i for i, x in enumerate(items) if x.lower() in filler_lower), -1)
        if drop_idx >= 0:
            items.pop(drop_idx)
            items_lower.pop(drop_idx)
        else:
            items.pop()
            items_lower.pop()

    meal["items"] = items


def _distribute_protein(meals, target_protein, proteins, correction_stats=None):
    total_protein = sum(m.get("protein", 0) for m in meals)
    if total_protein >= 0.9 * target_protein:
        return
    for _ in range(12):
        total_protein = sum(m.get("protein", 0) for m in meals)
        if total_protein >= 0.9 * target_protein:
            break
        lowest_meal = min(meals, key=lambda m: m.get("protein", 0))
        items = list(lowest_meal.get("items", []))
        items_lower = [x.lower() for x in items]
        added = False
        for p in proteins:
            if p.lower() not in items_lower:
                items.append(p)
                items_lower.append(p.lower())
                added = True
                if correction_stats is not None:
                    correction_stats["n"] = correction_stats.get("n", 0) + 1
                break
        if not added:
            break
        lowest_meal["items"] = items
        nutrition = calculate_meal_nutrition(items)
        lowest_meal["calories"] = nutrition["calories"]
        lowest_meal["protein"] = nutrition["protein"]


def score_plan(plan):
    meals = plan.get("meals", [])

    all_items = []
    for meal in meals:
        for item in meal.get("items", []):
            if isinstance(item, str):
                all_items.append(item.lower().strip())
    total_items = len(all_items)
    if total_items == 0:
        diversity_score = 0
    else:
        diversity_score = round(100 * len(set(all_items)) / total_items)

    n = len(meals)
    proteins = [float(m.get("protein", 0) or 0) for m in meals]
    t_protein = sum(proteins)
    if n == 0 or t_protein <= 0:
        balance_score = 100
    else:
        ideal = 1.0 / n
        raw_dev = sum(abs(p / t_protein - ideal) for p in proteins)
        deviation = raw_dev / 2
        balance_score = max(0, min(100, round(100 * (1 - deviation))))

    simplicity_score = 100
    for meal in meals:
        count = len(meal.get("items", []))
        simplicity_score -= 10 * max(0, count - 5)
    simplicity_score = max(0, min(100, simplicity_score))

    total = round((diversity_score + balance_score + simplicity_score) / 3)
    return {
        "score": total,
        "details": {
            "diversity": diversity_score,
            "balance": balance_score,
            "simplicity": simplicity_score,
        },
    }


def _plan_items_flat(plan):
    """Lowercase item strings across all meals, in order."""
    out = []
    for meal in plan.get("meals", []):
        for item in meal.get("items", []):
            if isinstance(item, str):
                out.append(item.lower().strip())
    return out


def _preference_selection_bonus(plan, user_data):
    if not isinstance(user_data, dict):
        return 0
    prefs = dedupe_merge_lists(
        [x for x in (user_data.get("high_rated_foods") or []) if isinstance(x, str)],
        [x for x in (user_data.get("preferred_foods") or []) if isinstance(x, str)],
    )
    if not prefs:
        return 0
    item_set = set(_plan_items_flat(plan))
    matched = 0
    for pref in prefs:
        if not isinstance(pref, str):
            continue
        pn = pref.strip().lower()
        if not pn:
            continue
        if any(pn == x or pn in x or x in pn for x in item_set):
            matched += 1
    return min(matched * 5, 10)


def _simplicity_selection_penalty(plan):
    for meal in plan.get("meals", []):
        if len(meal.get("items", [])) > 5:
            return 5
    return 0


def _repetition_selection_penalty(plan):
    flat = _plan_items_flat(plan)
    if not flat:
        return 0
    duplicate_excess = len(flat) - len(set(flat))
    return 5 if duplicate_excess > 2 else 0


def _final_selection_score(plan, base_score_data, user_data):
    base = base_score_data["score"]
    pref_bonus = _preference_selection_bonus(plan, user_data)
    simp_pen = _simplicity_selection_penalty(plan)
    rep_pen = _repetition_selection_penalty(plan)
    final = base + pref_bonus - simp_pen - rep_pen
    return final, {
        "preference_bonus": pref_bonus,
        "simplicity_penalty": simp_pen,
        "repetition_penalty": rep_pen,
    }


def _try_make_valid(
    plan,
    calories,
    macros,
    user_data,
    correction_stats=None,
    meal_target_fractions=None,
):
    """
    Run normalize → nutrition → targets → calorie correction → validate,
    with protein path if needed. Returns (plan, validation) or None.
    """
    def bump():
        if correction_stats is not None:
            correction_stats["n"] = correction_stats.get("n", 0) + 1

    bf, lf, df = (
        meal_target_fractions
        if meal_target_fractions is not None
        else _meal_target_fractions(user_data)
    )

    proteins, carbs, fillers = _effective_food_lists(user_data)
    protein_lower = {p.lower() for p in proteins}

    for meal in plan.get("meals", []):
        _normalize_meal(meal, proteins, carbs, fillers)
    bump()

    total_calculated = 0
    for meal in plan.get("meals", []):
        nutrition = calculate_meal_nutrition(meal.get("items", []))
        meal["calories"] = nutrition["calories"]
        meal["protein"] = nutrition["protein"]
        total_calculated += nutrition["calories"]

    for meal in plan.get("meals", []):
        name = meal.get("name", "").lower()
        if "breakfast" in name:
            target = calories * bf
        elif "lunch" in name:
            target = calories * lf
        elif "dinner" in name or "supper" in name:
            target = calories * df
        else:
            target = calories * (bf + lf + df) / 3.0
        meal["target_calories"] = int(target)

    if total_calculated < calories:
        factor = calories / max(total_calculated, 1)
        for meal in plan.get("meals", []):
            meal["calories"] = int(meal["calories"] * factor)
        bump()

    try:
        validation = validate_plan(plan, calories, macros["protein"])
        return plan, validation
    except ValueError as e:
        if "Protein too low" not in str(e):
            return None
        meals = plan.get("meals", [])
        _distribute_protein(meals, macros["protein"], proteins, correction_stats)
        for meal in meals:
            nutrition = calculate_meal_nutrition(meal.get("items", []))
            meal["calories"] = nutrition["calories"]
            meal["protein"] = nutrition["protein"]

        total_calories = sum(m.get("calories", 0) for m in meals)
        min_acceptable = calories - 300
        while total_calories > calories + 200 and total_calories > min_acceptable and meals:
            highest_meal = max(meals, key=lambda m: m.get("calories", 0))
            meal_items = list(highest_meal.get("items", []))
            if len(meal_items) <= 1:
                break
            idx = next((i for i, x in enumerate(meal_items) if x.lower() not in protein_lower), 0)
            meal_items.pop(idx)
            highest_meal["items"] = meal_items
            nutrition = calculate_meal_nutrition(meal_items)
            highest_meal["calories"] = nutrition["calories"]
            highest_meal["protein"] = nutrition["protein"]
            total_calories = sum(m.get("calories", 0) for m in meals)
            bump()
            if total_calories < min_acceptable:
                break

        total_calories = sum(m.get("calories", 0) for m in meals)
        if total_calories < min_acceptable and total_calories > 0:
            factor = calories / total_calories
            for m in meals:
                m["calories"] = int(m.get("calories", 0) * factor)
            bump()

        try:
            validation = validate_plan(plan, calories, macros["protein"])
            return plan, validation
        except Exception:
            return None
    except Exception:
        return None


def run_diet_agent(user_data, calories, macros, max_iterations=2):
    last_error = None
    last_plan = None
    best_partial = None
    best_partial_score = -1
    all_valid = []
    meal_target_fractions = _meal_target_fractions(user_data)
    adaptation = (
        ADAPTATION_SKIPPED_MEALS_NOTE if _skipped_meal_flags(user_data) else None
    )
    total_generations = max_iterations * CANDIDATES_PER_ROUND
    print(
        "[agent] start",
        f"iterations={max_iterations}",
        f"candidates_per_round={CANDIDATES_PER_ROUND}",
        f"plans_to_generate={total_generations}",
        "(LLM: Gemini or fallback; OpenAI not integrated)",
    )

    candidate_index = 0
    for _ in range(max_iterations):
        for _ in range(CANDIDATES_PER_ROUND):
            candidate_index += 1
            correction_stats = {"n": 0}
            plan = generate_diet_plan(user_data, calories, macros)
            last_plan = plan
            provider = LAST_DIET_PLAN_PROVIDER

            outcome = _try_make_valid(
                plan,
                calories,
                macros,
                user_data,
                correction_stats=correction_stats,
                meal_target_fractions=meal_target_fractions,
            )
            post_pipeline_score = score_plan(plan)
            valid = outcome is not None
            print(
                "[agent] candidate",
                candidate_index,
                f"provider={provider}",
                f"valid={valid}",
                f"score={post_pipeline_score['score']}",
                f"details={post_pipeline_score['details']}",
                f"corrections={correction_stats['n']}",
            )

            if outcome:
                p, v = outcome
                s = score_plan(p)
                all_valid.append((p, v, s))

            partial_s = score_plan(plan)
            if partial_s["score"] > best_partial_score:
                best_partial_score = partial_s["score"]
                best_partial = (plan, partial_s)

            if outcome is None:
                try:
                    validate_plan(plan, calories, macros["protein"])
                except Exception as ex:
                    last_error = str(ex)

    print("[agent] summary", f"plans_generated={candidate_index}", f"valid_candidates={len(all_valid)}")

    if all_valid:
        ranked = []
        for p, v, s in all_valid:
            final, sel = _final_selection_score(p, s, user_data)
            ranked.append((final, p, v, s, sel))
        final, p, v, s, sel = max(ranked, key=lambda t: t[0])
        score_out = {
            **s,
            "final_score": final,
            "selection": sel,
        }
        p["quality"] = score_out
        print(
            "[agent] selected",
            f"base_score={s['score']}",
            f"final_score={final}",
            f"weights={sel}",
            f"details={s['details']}",
            f"source=multi-plan",
        )
        out = {
            "plan": p,
            "validation": v,
            "score": score_out,
            "source": "multi-plan",
        }
        if adaptation:
            out["adaptation"] = adaptation
        return out

    if best_partial is not None:
        p, s = best_partial
        p["quality"] = s
        note = "No candidate passed validation; returning highest-scoring partial plan."
        if last_error:
            note += f" Last validation issue: {last_error}"
        p["note"] = note
        print(
            "[agent] selected",
            f"final_score={s['score']} (partial)",
            f"details={s['details']}",
            "source=multi-plan",
        )
        out = {
            "plan": p,
            "validation": {
                "total_calories": sum(m.get("calories", 0) for m in p.get("meals", [])),
                "total_protein": sum(m.get("protein", 0) for m in p.get("meals", [])),
                "status": "partial",
            },
            "score": s,
            "source": "multi-plan",
        }
        if adaptation:
            out["adaptation"] = adaptation
        return out

    print("[agent] failed", "no_valid_or_partial", f"last_error={last_error!r}")
    return {
        "error": "Agent failed after retries",
        "details": last_error,
        "plan": last_plan,
    }
