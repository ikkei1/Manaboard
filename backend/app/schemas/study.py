import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator
from app.schemas.common import SUBJECTS
class StudyLogBase(BaseModel):
    subject: str
    study_minutes: int = Field(ge=1, le=1440)
    studied_at: date
    memo: str | None = Field(default=None, max_length=500)
    @field_validator("subject")
    @classmethod
    def valid_subject(cls, value: str):
        if value not in SUBJECTS:
            raise ValueError("指定できない分野です")
        return value
    @field_validator("studied_at")
    @classmethod
    def not_future(cls, value: date):
        if value > date.today():
            raise ValueError("未来の日付は指定できません")
        return value
class StudyLogCreate(StudyLogBase):
    pass
class StudyLogUpdate(StudyLogBase):
    pass
class StudyLogOut(StudyLogBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
class StudyLogList(BaseModel):
    items: list[StudyLogOut]
    total: int
    page: int
    page_size: int
