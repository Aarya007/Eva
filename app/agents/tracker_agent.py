class TrackerAgent:
    def run(self, planned_meals, actual_meals):
        total_planned = len(planned_meals)
        total_completed = 0

        for meal in planned_meals:
            if meal["name"] in actual_meals:
                total_completed += 1

        adherence = (total_completed / max(total_planned, 1)) * 100

        return {
            "adherence": round(adherence, 2),
            "completed": total_completed,
            "total": total_planned,
        }
