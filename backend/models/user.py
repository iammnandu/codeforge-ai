from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import enum


class UserRole(str, enum.Enum):
    organizer = "organizer"
    candidate = "candidate"


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    username        = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name       = Column(String)
    role            = Column(String, default="candidate", nullable=False)
    is_active       = Column(Boolean, default=True)
    is_verified     = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    organized_contests  = relationship("Contest", back_populates="organizer")
    submissions         = relationship("Submission", back_populates="candidate")
    monitoring_sessions = relationship("MonitoringSession", back_populates="user")
    monitoring_events   = relationship("MonitoringEvent", back_populates="user")
