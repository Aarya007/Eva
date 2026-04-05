from typing import List, Optional

from pydantic import BaseModel, Field


class TrackInput(BaseModel):
    """Free-text meal / adherence lines (e.g. 'ate oats', 'skipped dinner')."""

    actual_meals: List[str] = Field(default_factory=list)
    notes: Optional[List[str]] = None
