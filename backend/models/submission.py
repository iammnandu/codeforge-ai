from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class Submission(Base):
    __tablename__ = "submissions"

    id           = Column(Integer, primary_key=True, index=True)
    problem_id   = Column(Integer, ForeignKey("problems.id"), nullable=False)
    contest_id   = Column(Integer, ForeignKey("contests.id"), nullable=True)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    language     = Column(String, nullable=False)
    code         = Column(Text, nullable=False)
    status       = Column(String, default="pending")
    # status values: pending | running | accepted | wrong_answer | time_limit_exceeded
    #                memory_limit_exceeded | runtime_error | compilation_error

    score            = Column(Float, default=0)
    time_ms          = Column(Integer)
    memory_kb        = Column(Integer)
    test_results     = Column(JSON, default=[])
    error_message    = Column(Text)
    submitted_at     = Column(DateTime(timezone=True), server_default=func.now())

    problem   = relationship("Problem")
    candidate = relationship("User", back_populates="submissions")
