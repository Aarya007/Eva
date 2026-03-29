def validate_plan(plan, target_calories, target_protein):
    meals = plan.get("meals", [])

    total_calories = sum(meal.get("calories", 0) for meal in meals)
    total_protein = sum(meal.get("protein", 0) for meal in meals)

    # Allow small deviation
    if abs(total_calories - target_calories) > 300:
        raise ValueError(
            f"Calorie mismatch: expected ~{target_calories}, got {total_calories}"
        )

    if total_protein < 0.8 * target_protein:
        raise ValueError("Protein too low")

    return {
        "total_calories": total_calories,
        "total_protein": total_protein,
        "status": "valid"
    }