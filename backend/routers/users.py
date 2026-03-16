from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi import HTTPException

from core.database import get_db
from core.dependencies import get_current_user
from core.security import verify_password, get_password_hash
from models.user import User
from schemas.user import UserOut, UserUpdate, PasswordChange

router = APIRouter()


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.email is not None and payload.email != current_user.email:
        existing_email = db.query(User).filter(User.email == payload.email, User.id != current_user.id).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = payload.email

    if payload.username is not None and payload.username != current_user.username:
        existing_username = db.query(User).filter(User.username == payload.username, User.id != current_user.id).first()
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already in use")
        current_user.username = payload.username

    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
