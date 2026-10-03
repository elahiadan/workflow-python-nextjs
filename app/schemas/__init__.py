"""Pydantic v2 schemas."""
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    is_active: bool
    created_at: datetime


# ---------- Workflows ----------
TriggerType = Literal["webhook", "schedule"]
StepType = Literal["condition", "action"]
WorkflowStatus = Literal["draft", "active", "inactive", "archived"]


class TriggerIn(BaseModel):
    type: TriggerType = "webhook"
    config: dict[str, Any] = Field(default_factory=dict)


class StepIn(BaseModel):
    name: str = ""
    type: StepType
    action: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)
    order: Optional[int] = None
    max_attempts: int = Field(default=3, ge=1, le=10)
    retry_delay_seconds: int = Field(default=30, ge=0, le=3600)
    timeout_seconds: int = Field(default=30, ge=1, le=300)


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    trigger: TriggerIn = Field(default_factory=TriggerIn)
    steps: list[StepIn] = Field(default_factory=list)


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[WorkflowStatus] = None
    trigger: Optional[TriggerIn] = None
    steps: Optional[list[StepIn]] = None


class TriggerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    type: str
    config: dict[str, Any]


class StepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_index: int
    type: str
    action: Optional[str]
    name: str
    config: dict[str, Any]
    max_attempts: int
    retry_delay_seconds: int
    timeout_seconds: int


class WebhookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    token: str
    is_active: bool
    created_at: datetime


class WorkflowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    triggers: list[TriggerOut] = []
    steps: list[StepOut] = []
    webhooks: list[WebhookOut] = []


class WorkflowListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str
    status: str
    version: int
    created_at: datetime
    updated_at: datetime


# ---------- Executions ----------
class StepExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    step_order: int
    step_type: str
    action: Optional[str]
    status: str
    attempt: int
    max_attempts: int
    input_data: dict[str, Any]
    output_data: dict[str, Any]
    error: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]


class ExecutionLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    level: str
    message: str
    context: dict[str, Any]
    created_at: datetime


class ExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workflow_id: str
    trigger_type: str
    trigger_payload: dict[str, Any]
    event_id: Optional[str]
    status: str
    error: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    created_at: datetime
    step_executions: list[StepExecutionOut] = []
    logs: list[ExecutionLogOut] = []


class ExecutionListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workflow_id: str
    trigger_type: str
    event_id: Optional[str]
    status: str
    error: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    created_at: datetime


# ---------- Integrations ----------
class IntegrationCreate(BaseModel):
    type: Literal["slack", "email", "http"]
    name: str = Field(min_length=1, max_length=255)
    config: dict[str, Any]


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[dict[str, Any]] = None


class IntegrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    type: str
    name: str
    config_preview: dict[str, Any]
    created_at: datetime
    updated_at: datetime


# ---------- Actions ----------
class HttpActionRequest(BaseModel):
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "POST"
    url: str
    headers: dict[str, str] = Field(default_factory=dict)
    params: dict[str, Any] = Field(default_factory=dict)
    body: Optional[Any] = None
    timeout: int = Field(default=30, ge=1, le=120)
