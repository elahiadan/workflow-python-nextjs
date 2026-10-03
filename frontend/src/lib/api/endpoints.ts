import "server-only"

import { api } from "./client"
import type {
  ActionsCatalog,
  AuthResponse,
  Execution,
  ExecutionSummary,
  ExecutionStatus,
  HttpActionRequest,
  HttpActionResult,
  Integration,
  IntegrationCreate,
  IntegrationUpdate,
  User,
  WebhookListItem,
  Workflow,
  WorkflowCreate,
  WorkflowStatus,
  WorkflowSummary,
  WorkflowUpdate,
} from "./types"

export type ListParams = {
  limit?: number
  offset?: number
}

export type WorkflowListParams = ListParams & { status?: WorkflowStatus | "" }

export type ExecutionListParams = ListParams & {
  workflow_id?: string
  status?: ExecutionStatus | ""
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    search.set(key, String(value))
  }
  const str = search.toString()
  return str ? `?${str}` : ""
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }),
  register: (email: string, password: string, full_name?: string) =>
    api.post<AuthResponse>("/auth/register", {
      email,
      password,
      ...(full_name ? { full_name } : {}),
    }),
  me: () => api.get<User>("/auth/me"),
  logout: (refresh_token: string) =>
    api.post<{ success: true; message: string }>("/auth/logout", { refresh_token }),
}

/** `/users/me` — an alias of `/auth/me` kept as its own endpoint. */
export const userApi = {
  me: () => api.get<User>("/users/me"),
}

export const workflowApi = {
  list: (params: WorkflowListParams = {}) => api.get<WorkflowSummary[]>(`/workflows${qs(params)}`),
  get: (id: string) => api.get<Workflow>(`/workflows/${id}`),
  create: (body: WorkflowCreate) => api.post<Workflow>("/workflows", body),
  update: (id: string, body: WorkflowUpdate) => api.put<Workflow>(`/workflows/${id}`, body),
  remove: (id: string) => api.del<{ success: true; message: string }>(`/workflows/${id}`),
  activate: (id: string) => api.post<Workflow>(`/workflows/${id}/activate`),
  deactivate: (id: string) => api.post<Workflow>(`/workflows/${id}/deactivate`),
  executions: (id: string, params: ListParams = {}) =>
    api.get<ExecutionSummary[]>(`/workflows/${id}/executions${qs(params)}`),
}

export const executionApi = {
  list: (params: ExecutionListParams = {}) => api.get<ExecutionSummary[]>(`/executions${qs(params)}`),
  get: (id: string) => api.get<Execution>(`/executions/${id}`),
}

export const webhookApi = {
  list: () => api.get<WebhookListItem[]>("/webhooks"),
  rotate: (id: string) => api.post<{ id: string; token: string }>(`/webhooks/${id}/rotate`),
}

export const integrationApi = {
  list: () => api.get<Integration[]>("/integrations"),
  get: (id: string) => api.get<Integration>(`/integrations/${id}`),
  create: (body: IntegrationCreate) => api.post<Integration>("/integrations", body),
  update: (id: string, body: IntegrationUpdate) =>
    api.put<Integration>(`/integrations/${id}`, body),
  remove: (id: string) =>
    api.del<{ success: true; message: string }>(`/integrations/${id}`),
}

export const actionApi = {
  catalog: () => api.get<ActionsCatalog>("/actions"),
  testHttp: (body: HttpActionRequest) => api.post<HttpActionResult>("/actions/http", body),
}
