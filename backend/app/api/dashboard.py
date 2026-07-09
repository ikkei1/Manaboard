from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.study_log import StudyLog
from app.models.user import User
from app.schemas.dashboard import DashboardOut
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
@router.get("", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    def total_between(start: date, end: date | None = None):
        query = select(func.coalesce(func.sum(StudyLog.study_minutes), 0)).where(StudyLog.user_id == current_user.id, StudyLog.studied_at >= start)
        if end:
            query = query.where(StudyLog.studied_at <= end)
        return db.scalar(query) or 0
    rows = db.execute(select(StudyLog.subject, func.sum(StudyLog.study_minutes)).where(StudyLog.user_id == current_user.id, StudyLog.studied_at >= month_start).group_by(StudyLog.subject)).all()
    total = sum(minutes for _, minutes in rows) or 1
    recent = db.scalars(select(StudyLog).where(StudyLog.user_id == current_user.id).order_by(StudyLog.studied_at.desc(), StudyLog.created_at.desc()).limit(5)).all()
    return {
        "today_minutes": total_between(today, today),
        "week_minutes": total_between(week_start),
        "month_minutes": total_between(month_start),
        "subject_shares": [{"subject": subject, "minutes": minutes, "percent": round(minutes / total * 100)} for subject, minutes in rows],
        "recent_logs": recent,
    }
