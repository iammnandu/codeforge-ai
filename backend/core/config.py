from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@codeforgeai.com"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

    FRONTEND_URL: str = "http://localhost:3000"
    GOOGLE_CLIENT_ID: str = ""

    CV_FRAME_SKIP: int = 3
    CV_SUSPICION_THRESHOLD: int = 70
    CV_PHONE_CONFIDENCE: float = 0.55

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
