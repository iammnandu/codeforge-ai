from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import secrets
import string


def generate_contest_code(length=8):
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


class Contest(Base):
    __tablename__ = "contests"

    id               = Column(Integer, primary_key=True, index=True)
    title            = Column(String, nullable=False)
    description      = Column(Text)
    organizer_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    contest_code     = Column(String(12), unique=True, index=True, default=generate_contest_code)
    start_time       = Column(DateTime(timezone=True), nullable=False)
    end_time         = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    allowed_languages = Column(JSON, default=["python", "cpp", "java", "javascript"])
    is_active        = Column(Boolean, default=False)
    is_published     = Column(Boolean, default=False)
    proctoring_enabled = Column(Boolean, default=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    organizer    = relationship("User", back_populates="organized_contests")
    problems     = relationship("ContestProblem", back_populates="contest", cascade="all, delete-orphan")
    participants = relationship("ContestParticipant", back_populates="contest", cascade="all, delete-orphan")


class ContestProblem(Base):
    __tablename__ = "contest_problems"

    id         = Column(Integer, primary_key=True)
    contest_id = Column(Integer, ForeignKey("contests.id"), nullable=False)
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=False)
    order      = Column(Integer, default=0)
    points     = Column(Integer, default=100)

    contest = relationship("Contest", back_populates="problems")
    problem = relationship("Problem")


class ContestParticipant(Base):
    __tablename__ = "contest_participants"

    id         = Column(Integer, primary_key=True)
    contest_id = Column(Integer, ForeignKey("contests.id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at  = Column(DateTime(timezone=True), server_default=func.now())
    score      = Column(Integer, default=0)
    rank       = Column(Integer)

    contest = relationship("Contest", back_populates="participants")
    user    = relationship("User")
