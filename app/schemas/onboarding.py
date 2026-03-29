from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


class OnboardingInput(BaseModel):
    """Full onboarding submit (POST /onboard)."""

    # Step 1 — Basic
    age: int = Field(ge=1, le=120)
    weight: float = Field(gt=0)
    height: float = Field(gt=0)
    gender: str

    # Step 2 — Medical
    medical_none_ack: bool = False
    medical_conditions: Optional[List[str]] = None
    medications: Optional[List[str]] = None

    # Step 3 — Lifestyle
    sleep_hours: float = Field(ge=0, le=24)
    stress_level: str
    work_schedule: str

    # Step 4 — Eating
    diet_type: Optional[str] = None
    allergies: Optional[List[str]] = None
    preferred_foods: Optional[List[str]] = None
    disliked_foods: Optional[List[str]] = None

    # Step 5 — Goals
    goal: str
    activity_level: str
    target_weight_kg: Optional[float] = Field(default=None, gt=0)
    goal_timeline_weeks: Optional[int] = Field(default=None, ge=1)

    # Step 6 — Measurements
    measurements_na: bool = False
    waist_cm: Optional[float] = Field(default=None, gt=0)
    body_fat_pct: Optional[float] = Field(default=None, ge=0, le=100)

    # Step 7 — Personalization / fitness
    fitness_type: Optional[str] = None
    gym_level: Optional[str] = None
    sport_type: Optional[str] = None
    training_intensity: Optional[str] = None
    training_environment: Optional[str] = None  # gym | outside | both (athlete)
    display_name: Optional[str] = None
    timezone: Optional[str] = None

    @model_validator(mode="after")
    def validate_medical(self):
        if self.medical_none_ack:
            return self
        c = self.medical_conditions or []
        m = self.medications or []
        if len(c) == 0 and len(m) == 0:
            raise ValueError(
                "Either confirm no medical info (medical_none_ack) or add conditions/medications"
            )
        return self

    @model_validator(mode="after")
    def validate_measurements(self):
        if self.measurements_na:
            return self
        if self.waist_cm is None and self.body_fat_pct is None:
            raise ValueError(
                "Provide waist_cm and/or body_fat_pct, or set measurements_na"
            )
        return self


class OnboardingStepInput(BaseModel):
    """Partial step save (POST /onboarding/step). All fields optional."""

    age: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    gender: Optional[str] = None
    medical_none_ack: Optional[bool] = None
    medical_conditions: Optional[List[str]] = None
    medications: Optional[List[str]] = None
    sleep_hours: Optional[float] = None
    stress_level: Optional[str] = None
    work_schedule: Optional[str] = None
    diet_type: Optional[str] = None
    allergies: Optional[List[str]] = None
    preferred_foods: Optional[List[str]] = None
    disliked_foods: Optional[List[str]] = None
    goal: Optional[str] = None
    activity_level: Optional[str] = None
    target_weight_kg: Optional[float] = None
    goal_timeline_weeks: Optional[int] = None
    measurements_na: Optional[bool] = None
    waist_cm: Optional[float] = None
    body_fat_pct: Optional[float] = None
    fitness_type: Optional[str] = None
    gym_level: Optional[str] = None
    sport_type: Optional[str] = None
    training_intensity: Optional[str] = None
    training_environment: Optional[str] = None
    display_name: Optional[str] = None
    timezone: Optional[str] = None
