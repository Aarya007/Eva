def calculate_bmr(weight, height, age, gender):
    if gender.lower() == "male":
        return 10 * weight + 6.25 * height - 5 * age + 5
    else:
        return 10 * weight + 6.25 * height - 5 * age - 161


def calculate_tdee(bmr, activity_level):
    multipliers = {
        "sedentary": 1.2,
        "moderate": 1.55,
        "active": 1.725
    }
    return bmr * multipliers.get(activity_level, 1.2)


def calculate_target_calories(tdee, goal):
    if goal == "fat_loss":
        return tdee - 400
    elif goal == "muscle_gain":
        return tdee + 300
    return tdee


def calculate_macros(calories, weight):
    protein = weight * 1.8  # grams
    fats = calories * 0.25 / 9
    carbs = (calories - (protein * 4 + fats * 9)) / 4

    return {
        "protein": round(protein),
        "fats": round(fats),
        "carbs": round(carbs)
    }