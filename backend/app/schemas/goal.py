import uuid
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from app.schemas.common import SUBJECTS
class GoalBase(BaseModel):
    subject: str
    target_minutes: int = Field(ge=1)
    @field_validator("subject")
    @classmethod
    def valid_subject(cls, value: str):
        if value not in SUBJECTS:
            raise ValueError("指定できない分野です")
        return value
class GoalCreate(GoalBase):
    pass
class GoalUpdate(GoalBase):
    pass
class GoalOut(GoalBase):
    id: uuid.UUID
    current_minutes: int = 0
    achievement_rate: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
