import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FlashcardBase(BaseModel):
    subject: str
    term: str = Field(min_length=1, max_length=80)
    definition: str = Field(min_length=1)
    exam_point: str = Field(min_length=1)


class FlashcardCreate(FlashcardBase):
    pass


class FlashcardUpdate(FlashcardBase):
    status: str


class FlashcardReview(BaseModel):
    remembered: bool


class FlashcardOut(FlashcardBase):
    id: uuid.UUID
    status: str
    review_count: int
    correct_count: int
    last_reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FlashcardStats(BaseModel):
    total: int
    new: int
    learning: int
    mastered: int


class FlashcardList(BaseModel):
    items: list[FlashcardOut]
    stats: FlashcardStats
