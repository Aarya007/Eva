from typing import Any, Optional

from pydantic import BaseModel


class UserInput(BaseModel):
    age: int
    weight: float
    height: float
    gender: str
    activity_level: str  # sedentary / moderate / active
    goal: str  # fat_loss / muscle_gain / maintenance
    diet_type: str  # veg / non_veg / vegan
    disliked_foods: Optional[list[str]] = None
    preferred_foods: Optional[list[str]] = None
    skipped_meals: Optional[list[str]] = None
    actual_meals: Optional[list[str]] = None


class FeedbackInput(BaseModel):
    rating: int
    feedback_text: Optional[str] = None
    plan: dict[str, Any]
