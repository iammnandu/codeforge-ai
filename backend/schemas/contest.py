from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ContestCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    allowed_languages: List[str] = ["python", "cpp", "java", "javascript"]
    proctoring_enabled: bool = True


class ContestOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    contest_code: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    is_active: bool
    is_published: bool
    proctoring_enabled: bool
    organizer_id: int

    class Config:
        from_attributes = True


class ContestDetail(ContestOut):
    allowed_languages: List[str]


class JoinContest(BaseModel):
    contest_code: str


class ParticipantOut(BaseModel):
    user_id: int
    score: float
    rank: Optional[int]
    joined_at: datetime

    class Config:
        from_attributes = True
