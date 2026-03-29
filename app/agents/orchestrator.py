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
            adherence = self.tracker_agent.run(
                result["plan"]["meals"],
                actual_meals,
            )

            recommendations = self.recommender_agent.run(
                adherence,
                result["plan"],
            )

            result["adherence"] = adherence
            result["recommendations"] = recommendations

        return result
