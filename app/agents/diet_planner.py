class DietPlannerAgent:
    def __init__(self):
        pass

    def run(self, user_data, calories, macros):
        from app.services.agent import run_diet_agent

        return run_diet_agent(user_data, calories, macros)
