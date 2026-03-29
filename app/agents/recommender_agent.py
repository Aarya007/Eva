class RecommenderAgent:
    def run(self, adherence_data, plan):
        recommendations = []

        if adherence_data["adherence"] < 70:
            recommendations.append("Try simpler meals to improve consistency")

        total_protein = sum(m.get("protein", 0) for m in plan.get("meals", []))

        if total_protein < 100:
            recommendations.append("Increase protein intake (paneer, eggs, dal)")

        if not recommendations:
            recommendations.append("Great job! Keep following the plan")

        return {
            "recommendations": recommendations,
        }
