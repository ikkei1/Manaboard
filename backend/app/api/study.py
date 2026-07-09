import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.study_log import StudyLog
from app.models.user import User
from app.schemas.common import SUBJECTS
from app.schemas.study import StudyLogCreate, StudyLogList, StudyLogOut, StudyLogUpdate

router = APIRouter(prefix="/study", tags=["Study"])


@router.get("", response_model=StudyLogList)
def list_study_logs(
    page: int = Query(1, ge=1),
    subject: str | None = Query(None),
    studied_at: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    page_size = 20
    query = select(StudyLog).where(StudyLog.user_id == current_user.id)
    if subject:
        query = query.where(StudyLog.subject == subject)
    if studied_at:
        query = query.where(StudyLog.studied_at == studied_at)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(StudyLog.studied_at.desc(), StudyLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/subjects/options")
def subjects():
    return SUBJECTS


@router.get("/{log_id}", response_model=StudyLogOut)
def get_study_log(log_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = db.get(StudyLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Study log not found")
    return log


@router.post("", response_model=StudyLogOut, status_code=status.HTTP_201_CREATED)
def create_study_log(payload: StudyLogCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = StudyLog(user_id=current_user.id, **payload.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.put("/{log_id}", response_model=StudyLogOut)
def update_study_log(
    log_id: uuid.UUID,
    payload: StudyLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.get(StudyLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Study log not found")
    for key, value in payload.model_dump().items():
        setattr(log, key, value)
    db.commit()
    db.refresh(log)
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_study_log(log_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = db.get(StudyLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Study log not found")
    db.delete(log)
    db.commit()
    return None