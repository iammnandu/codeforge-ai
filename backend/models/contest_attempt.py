from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class ContestAttempt(Base):
    __tablename__ = "contest_attempts"

    id = Column(Integer, primary_key=True)
    contest_id = Column(Integer, ForeignKey("contests.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    is_submitted = Column(Boolean, default=False)
    submitted_at = Column(DateTime(timezone=True))
    feedback_rating = Column(Integer)
    feedback_text = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contest = relationship("Contest")
    user = relationship("User")
