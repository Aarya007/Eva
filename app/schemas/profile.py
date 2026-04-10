from typing import Optional

from pydantic import BaseModel, Field


class ProfilePatch(BaseModel):
    """Partial profile update; only sent fields are merged into user memory."""

    display_name: Optional[str] = None
    height: Optional[float] = Field(None, ge=50, le=280)
    weight: Optional[float] = Field(None, ge=20, le=400)
    body_fat_pct: Optional[float] = Field(None, ge=0, le=100)
    goal: Optional[str] = None
    diet_type: Optional[str] = None
    timezone: Optional[str] = None
