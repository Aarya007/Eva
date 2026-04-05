from app.agents.diet_planner import DietPlannerAgent
from app.agents.tracker_agent import TrackerAgent
from app.agents.recommender_agent import RecommenderAgent


class Orchestrator:
    def __init__(self):
        self.diet_agent = DietPlannerAgent()
        self.tracker_agent = TrackerAgent()
        self.recommender_agent = RecommenderAgent()

    def run(self, user_data, calories, macros, actual_meals=None):
        result = self.diet_agent.run(user_data, calories, macros)

        if actual_meals:
            plan = result.get("plan")
            if not isinstance(plan, dict) or not isinstance(plan.get("meals"), list):
                return result
            adherence = self.tracker_agent.run(
                plan["meals"],
                actual_meals,
            )

            recommendations = self.recommender_agent.run(
                adherence,
                plan,
            )

            result["adherence"] = adherence
            result["recommendations"] = recommendations

        return result
