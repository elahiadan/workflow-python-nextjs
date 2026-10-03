/**
 * Types mirroring the FastAPI backend exactly.
 * Source of truth: app/schemas/__init__.py + app/api/routes/*.
 */

export type User = {
  id: string
  email: string
  full_name: string
  is_active: boolean
  created_at: string
}

export type TokenPair = {
  access_token: string
  refresh_token: string
  token_type: string
}

export type AuthResponse = {
  user: User
  tokens: TokenPair
}

export type TriggerType = "webhook" | "schedule"

export type WorkflowStatus = "draft" | "active" | "inactive" | "archived"

export type StepType = "condition" | "action"

export type ExecutionStatus = "pending" | "running" | "success" | "failed"

export type StepExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped"

export type ConditionOperator =
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "in"
  | "not_in"
  | "is_empty"
  | "is_not_empty"

export type TriggerIn = {
  type?: TriggerType
  config?: Record<string, unknown>
}

export type TriggerOut = {
  id: string
  type: string
  config: Record<string, unknown>
}

export type StepIn = {
  name?: string
  type: StepType
  action?: string | null
  config?: Record<string, unknown>
  order?: number | null
  max_attempts?: number
  retry_delay_seconds?: number
  timeout_seconds?: number
}

export type StepOut = {
  id: string
  order_index: number
  type: string
  action: string | null
  name: string
  config: Record<string, unknown>
  max_attempts: number
  retry_delay_seconds: number
  timeout_seconds: number
}

export type WebhookOut = {
  id: string
  token: string
  is_active: boolean
  created_at: string
}

export type WebhookListItem = WebhookOut & { workflow_id: string }

export type Workflow = {
  id: string
  name: string
  description: string
  status: WorkflowStatus
  version: number
  created_at: string
  updated_at: string
  triggers: TriggerOut[]
  steps: StepOut[]
  webhooks: WebhookOut[]
}

export type WorkflowSummary = {
  id: string
  name: string
  description: string
  status: WorkflowStatus
  version: number
  created_at: string
  updated_at: string
}

export type WorkflowCreate = {
  name: string
  description?: string
  trigger?: TriggerIn
  steps?: StepIn[]
}

export type WorkflowUpdate = Partial<WorkflowCreate> & {
  status?: WorkflowStatus
}

export type StepExecution = {
  id: string
  step_order: number
  step_type: string
  action: string | null
  status: StepExecutionStatus
  attempt: number
  max_attempts: number
  input_data: Record<string, unknown>
  output_data: Record<string, unknown>
  error: string | null
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
}

export type ExecutionLog = {
  id: string
  level: "INFO" | "WARNING" | "ERROR" | string
  message: string
  context: Record<string, unknown>
  created_at: string
}

export type Execution = {
  id: string
  workflow_id: string
  trigger_type: string
  trigger_payload: Record<string, unknown>
  event_id: string | null
  status: ExecutionStatus
  error: string | null
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  created_at: string
  step_executions: StepExecution[]
  logs: ExecutionLog[]
}

export type ExecutionSummary = {
  id: string
  workflow_id: string
  trigger_type: string
  event_id: string | null
  status: ExecutionStatus
  error: string | null
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  created_at: string
}

export type IntegrationType = "slack" | "email" | "http"

export type Integration = {
  id: string
  type: IntegrationType
  name: string
  config_preview: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type IntegrationCreate = {
  type: IntegrationType
  name: string
  config: Record<string, unknown>
}

export type IntegrationUpdate = {
  name?: string
  config?: Record<string, unknown>
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export type HttpActionRequest = {
  method?: HttpMethod
  url: string
  headers?: Record<string, string>
  params?: Record<string, unknown>
  body?: unknown
  timeout?: number
}

export type HttpActionResult = {
  success: boolean
  data: {
    status_code: number
    /** Parsed JSON body, or `{ text }` when the response is not JSON. */
    response?: unknown
    /** Present for `mock://` URLs, which never touch the network. */
    mock?: boolean
    method?: string
    url?: string
  }
}

/** The single error envelope every endpoint uses. */
export type ApiErrorBody = {
  success: false
  message: string
  error: { code: string; details?: unknown }
}

export type ActionsCatalog = { actions: string[] }

export type SimpleSuccess = { success: true; message: string }
