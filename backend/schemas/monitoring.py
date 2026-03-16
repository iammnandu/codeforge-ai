from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class MonitoringEventOut(BaseModel):
    id: int
    event_type: str
    severity: str
    confidence: Optional[float]
    score_delta: float
    details: Optional[Any]
    timestamp: datetime

    class Config:
        from_attributes = True


class SessionOut(BaseModel):
    id: int
    user_id: int
    contest_id: int
    started_at: datetime
    ended_at: Optional[datetime]
    suspicion_score: float
    is_flagged: bool

    class Config:
        from_attributes = True
