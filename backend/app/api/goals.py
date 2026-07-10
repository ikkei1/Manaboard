import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.goal import Goal
from app.models.study_log import StudyLog
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalOut, GoalUpdate
router = APIRouter(prefix="/goals", tags=["Goal"])
def with_progress(db: Session, user_id, goal: Goal):
    current = db.scalar(select(func.coalesce(func.sum(StudyLog.study_minutes), 0)).where(StudyLog.user_id == user_id, StudyLog.subject == goal.subject)) or 0
    data = GoalOut.model_validate(goal).model_dump()
    data["current_minutes"] = current
    data["achievement_rate"] = min(100, round(current / goal.target_minutes * 100)) if goal.target_minutes else 0
    return data
@router.get("", response_model=list[GoalOut])
def list_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goals = db.scalars(select(Goal).where(Goal.user_id == current_user.id).order_by(Goal.created_at.desc())).all()
    return [with_progress(db, current_user.id, goal) for goal in goals]
@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exists = db.scalar(select(Goal).where(Goal.user_id == current_user.id, Goal.subject == payload.subject))
    if exists:
        raise HTTPException(status_code=400, detail="この分野の目標は既に登録されています")
    goal = Goal(user_id=current_user.id, **payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return with_progress(db, current_user.id, goal)
@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: uuid.UUID, payload: GoalUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = db.get(Goal, goal_id)
    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="目標が見つかりません")
    for key, value in payload.model_dump().items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return with_progress(db, current_user.id, goal)
@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = db.get(Goal, goal_id)
    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="目標が見つかりません")
    db.delete(goal)
    db.commit()
    return None
