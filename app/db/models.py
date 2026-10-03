"""Normalized domain models."""
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

UUID_STR = String(36)


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now, nullable=False)

    workflows: Mapped[list["Workflow"]] = relationship("Workflow", back_populates="user",
                                                       cascade="all, delete-orphan")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Workflow(Base):
    __tablename__ = "workflows"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("users.id", ondelete="CASCADE"),
                                        index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    user: Mapped[User] = relationship("User", back_populates="workflows")
    triggers: Mapped[list["WorkflowTrigger"]] = relationship("WorkflowTrigger", back_populates="workflow",
                                                             cascade="all, delete-orphan")
    steps: Mapped[list["WorkflowStep"]] = relationship("WorkflowStep", back_populates="workflow",
                                                       cascade="all, delete-orphan",
                                                       order_by="WorkflowStep.order_index")
    webhooks: Mapped[list["Webhook"]] = relationship("Webhook", back_populates="workflow",
                                                     cascade="all, delete-orphan")
    executions: Mapped[list["WorkflowExecution"]] = relationship("WorkflowExecution",
                                                                 back_populates="workflow",
                                                                 cascade="all, delete-orphan")

    __table_args__ = (Index("ix_workflows_user_status", "user_id", "status"),)


class WorkflowTrigger(Base):
    __tablename__ = "workflow_triggers"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    workflow_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("workflows.id", ondelete="CASCADE"),
                                            index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)  # webhook|schedule
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    workflow: Mapped[Workflow] = relationship("Workflow", back_populates="triggers")


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    workflow_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("workflows.id", ondelete="CASCADE"),
                                            index=True, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)  # condition|action
    action: Mapped[str | None] = mapped_column(String(64), nullable=True)
    name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    retry_delay_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    workflow: Mapped[Workflow] = relationship("Workflow", back_populates="steps")
    conditions: Mapped[list["WorkflowCondition"]] = relationship("WorkflowCondition",
                                                                 back_populates="step",
                                                                 cascade="all, delete-orphan")


class WorkflowCondition(Base):
    """Optional normalized mirror of a condition step's rule (queryable copy)."""
    __tablename__ = "workflow_conditions"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    step_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("workflow_steps.id", ondelete="CASCADE"),
                                        index=True, nullable=False)
    field: Mapped[str] = mapped_column(String(255), nullable=False)
    operator: Mapped[str] = mapped_column(String(32), nullable=False)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON, nullable=True)

    step: Mapped[WorkflowStep] = relationship("WorkflowStep", back_populates="conditions")


class Webhook(Base):
    __tablename__ = "webhooks"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    workflow_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("workflows.id", ondelete="CASCADE"),
                                            index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("users.id", ondelete="CASCADE"),
                                        index=True, nullable=False)
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    secret: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    workflow: Mapped[Workflow] = relationship("Workflow", back_populates="webhooks")


class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    workflow_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("workflows.id", ondelete="CASCADE"),
                                            index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("users.id", ondelete="CASCADE"),
                                        index=True, nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(32), default="webhook", nullable=False)
    trigger_payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    event_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True, nullable=False)

    workflow: Mapped[Workflow] = relationship("Workflow", back_populates="executions")
    step_executions: Mapped[list["StepExecution"]] = relationship("StepExecution",
                                                                  back_populates="execution",
                                                                  cascade="all, delete-orphan")
    logs: Mapped[list["ExecutionLog"]] = relationship("ExecutionLog", back_populates="execution",
                                                      cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("workflow_id", "event_id", name="uq_execution_workflow_event"),
        Index("ix_executions_workflow_status", "workflow_id", "status"),
    )


class StepExecution(Base):
    __tablename__ = "step_executions"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    execution_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("workflow_executions.id",
                                                                  ondelete="CASCADE"),
                                             index=True, nullable=False)
    step_id: Mapped[str | None] = mapped_column(UUID_STR, nullable=True)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    step_type: Mapped[str] = mapped_column(String(32), nullable=False)
    action: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    input_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    output_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    execution: Mapped[WorkflowExecution] = relationship("WorkflowExecution",
                                                        back_populates="step_executions")


class ExecutionLog(Base):
    __tablename__ = "execution_logs"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    execution_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("workflow_executions.id",
                                                                  ondelete="CASCADE"),
                                             index=True, nullable=False)
    step_execution_id: Mapped[str | None] = mapped_column(UUID_STR, nullable=True)
    level: Mapped[str] = mapped_column(String(16), default="INFO", nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)

    execution: Mapped[WorkflowExecution] = relationship("WorkflowExecution", back_populates="logs")


class Integration(Base):
    __tablename__ = "integrations"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("users.id", ondelete="CASCADE"),
                                        index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)  # slack|email|http
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    config_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    config_preview: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class ScheduledJob(Base):
    __tablename__ = "scheduled_jobs"
    id: Mapped[str] = mapped_column(UUID_STR, primary_key=True, default=_uuid)
    workflow_id: Mapped[str] = mapped_column(UUID_STR, ForeignKey("workflows.id", ondelete="CASCADE"),
                                            index=True, nullable=False)
    schedule: Mapped[str] = mapped_column(String(128), nullable=False)  # cron or alias
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
