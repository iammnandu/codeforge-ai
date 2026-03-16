from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class MonitoringSession(Base):
    """One session per candidate per contest."""
    __tablename__ = "monitoring_sessions"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    contest_id       = Column(Integer, ForeignKey("contests.id"), nullable=False)
    started_at       = Column(DateTime(timezone=True), server_default=func.now())
    ended_at         = Column(DateTime(timezone=True))
    suspicion_score  = Column(Float, default=0.0)   # 0-100
    is_flagged       = Column(Boolean, default=False)
    calibration_data = Column(JSON)  # Homography matrix from environment scan

    user   = relationship("User", back_populates="monitoring_sessions")
    events = relationship("MonitoringEvent", back_populates="session", cascade="all, delete-orphan")


class MonitoringEvent(Base):
    """Individual cheating signal detected during a session."""
    __tablename__ = "monitoring_events"

    id          = Column(Integer, primary_key=True, index=True)
    session_id  = Column(Integer, ForeignKey("monitoring_sessions.id"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_type  = Column(String, nullable=False)
    # event_type values:
    #   face_missing | multiple_faces | phone_detected | tablet_detected
    #   gaze_left | gaze_right | gaze_down | head_turn
    #   tab_switch | window_blur | paste_detected | idle_timeout
    #   environment_scan_failed | calibration_failed

    severity      = Column(String, default="medium")  # low | medium | high | critical
    confidence    = Column(Float)                      # 0.0 - 1.0
    score_delta   = Column(Float, default=0)           # points added to suspicion score
    details       = Column(JSON)                       # raw detection metadata
    snapshot_path = Column(String)                     # path to saved frame (optional)
    timestamp     = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("MonitoringSession", back_populates="events")
    user    = relationship("User")
