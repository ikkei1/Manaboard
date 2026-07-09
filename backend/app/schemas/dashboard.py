from pydantic import BaseModel
from app.schemas.study import StudyLogOut
class SubjectShare(BaseModel):
    subject: str
    minutes: int
    percent: int
class DashboardOut(BaseModel):
    today_minutes: int
    week_minutes: int
    month_minutes: int
    subject_shares: list[SubjectShare]
    recent_logs: list[StudyLogOut]
