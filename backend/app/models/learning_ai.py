import uuid
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class AIProblem(Base):
    __tablename__ = "ai_problems"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject: Mapped[str] = mapped_column(String(30)); unit: Mapped[str] = mapped_column(String(100))
    difficulty: Mapped[str] = mapped_column(String(20)); format: Mapped[str] = mapped_column(String(30))
    question: Mapped[str] = mapped_column(Text); choices: Mapped[list | None] = mapped_column(JSON, nullable=True)
    answer: Mapped[str] = mapped_column(Text); explanation: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ProblemAttempt(Base):
    __tablename__ = "problem_attempts"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    problem_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ai_problems.id", ondelete="CASCADE"), index=True)
    user_answer: Mapped[str] = mapped_column(Text); is_correct: Mapped[bool] = mapped_column(Boolean)
    mistake_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    answered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class StudySchedule(Base):
    __tablename__ = "study_schedules"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    goal_name: Mapped[str] = mapped_column(String(150)); scheduled_date: Mapped[date] = mapped_column(Date)
    subject: Mapped[str] = mapped_column(String(30)); unit: Mapped[str] = mapped_column(String(100))
    study_minutes: Mapped[int] = mapped_column(Integer); task_detail: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(20), default="medium"); is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class OCRQuestion(Base):
    __tablename__ = "ocr_questions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject: Mapped[str] = mapped_column(String(30)); image_url: Mapped[str] = mapped_column(Text, default="local-upload")
    ocr_text: Mapped[str] = mapped_column(Text); corrected_text: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float); ai_answer: Mapped[str] = mapped_column(Text)
    ai_explanation: Mapped[str] = mapped_column(Text); similar_problem: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
