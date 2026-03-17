import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from google.auth.transport import requests
from google.oauth2 import id_token
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.dependencies import get_current_user
from core.security import verify_password, get_password_hash, create_access_token
from models.user import User
from schemas.user import UserCreate, UserOut, Token

router = APIRouter()


class GoogleAuthIn(BaseModel):
    id_token: str
    role: str = "candidate"


def _derive_unique_username(db: Session, email: str) -> str:
    base_username = email.split("@")[0].strip() or "user"
    candidate_username = base_username
    suffix = 1
    while db.query(User).filter(User.username == candidate_username).first():
        suffix += 1
        candidate_username = f"{base_username}{suffix}"
    return candidate_username


@router.post("/signup", response_model=UserOut, status_code=201)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username taken")

    user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "user_id": user.id}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/google", response_model=Token)
def google_auth(payload: GoogleAuthIn, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")

    try:
        google_payload = id_token.verify_oauth2_token(
            payload.id_token,
            requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = google_payload.get("email")
    email_verified = google_payload.get("email_verified")
    full_name = google_payload.get("name")

    if not email or not email_verified:
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        role = payload.role if payload.role in {"organizer", "candidate"} else "candidate"
        user = User(
            email=email,
            username=_derive_unique_username(db, email),
            full_name=full_name,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            role=role,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "user_id": user.id}
