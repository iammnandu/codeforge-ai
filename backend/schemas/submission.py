from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class SubmissionCreate(BaseModel):
    problem_id: int
    contest_id: Optional[int] = None
    language: str
    code: str


class SubmissionOut(BaseModel):
    id: int
    problem_id: int
    contest_id: Optional[int]
    language: str
    status: str
    score: float
    time_ms: Optional[int]
    test_results: Optional[List[Any]]
    error_message: Optional[str]
    submitted_at: datetime

    class Config:
        from_attributes = True
