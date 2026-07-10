from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User

LOCAL_USER_EMAIL = "local@manaboard.local"


def get_current_user(db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == LOCAL_USER_EMAIL))
    if user:
        return user
    user = User(name="Manaboard User", email=LOCAL_USER_EMAIL, password_hash=hash_password("local-only-user"))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
