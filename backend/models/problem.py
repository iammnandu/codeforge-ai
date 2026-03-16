from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from core.database import Base


class Problem(Base):
    __tablename__ = "problems"

    id               = Column(Integer, primary_key=True, index=True)
    title            = Column(String, nullable=False)
    slug             = Column(String, unique=True, index=True)
    description      = Column(Text, nullable=False)
    input_format     = Column(Text)
    output_format    = Column(Text)
    constraints      = Column(Text)
    difficulty       = Column(String, default="medium")  # easy | medium | hard
    time_limit_ms    = Column(Integer, default=2000)
    memory_limit_mb  = Column(Integer, default=256)
    is_public        = Column(Boolean, default=True)
    created_by       = Column(Integer, ForeignKey("users.id"))
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    sample_input     = Column(Text)
    sample_output    = Column(Text)
    editorial        = Column(Text)
    tags             = Column(JSON, default=[])

    test_cases = relationship("TestCase", back_populates="problem", cascade="all, delete-orphan")
    creator    = relationship("User")


class TestCase(Base):
    __tablename__ = "test_cases"

    id         = Column(Integer, primary_key=True)
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=False)
    input      = Column(Text, nullable=False)
    expected   = Column(Text, nullable=False)
    is_sample  = Column(Boolean, default=False)   # True = shown to user; False = hidden
    is_hidden  = Column(Boolean, default=True)
    order      = Column(Integer, default=0)

    problem = relationship("Problem", back_populates="test_cases")
