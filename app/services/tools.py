FOOD_DB = {
    "oats": {"calories": 150, "protein": 5},
    "milk": {"calories": 120, "protein": 6},
    "banana": {"calories": 100, "protein": 1},
    "rice": {"calories": 200, "protein": 4},
    "dal": {"calories": 180, "protein": 9},
    "paneer": {"calories": 250, "protein": 18},
    "chapati": {"calories": 120, "protein": 3},
    "egg": {"calories": 70, "protein": 6},
}


def get_food_data(food_name: str):
    return FOOD_DB.get(food_name.lower(), None)
def calculate_meal_nutrition(items):
    total_calories = 0
    total_protein = 0

    for item in items:
        food = get_food_data(item)
        if food:
            total_calories += food["calories"]
            total_protein += food["protein"]

    return {
        "calories": total_calories,
        "protein": total_protein
    }    