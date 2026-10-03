"use client"

import { ApiError } from "./error"
import type {
  Execution,
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

const BASE = "/api/wf"

type Params = Record<string, string | number | undefined | null>

function qs(params: Params = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    search.set(key, String(value))
  }
  const str = search.toString()
  return str ? `?${str}` : ""
}

async function request<T>(
  path: string,
  init: RequestInit & { params?: Params } = {},
): Promise<T> {
  const { params, ...rest } = init
  const res = await fetch(`${BASE}${path}${qs(params)}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
  })

  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(res.status, {
      success: false,
      message: data?.message ?? `Request failed (${res.status})`,
      error: { code: data?.error?.code ?? "UNKNOWN", details: data?.error?.details },
    })
  }
  return data as T
}

const body = (value: unknown) => JSON.stringify(value)

export const apiClient = {
  me: () => request<User>("/auth/me"),

  workflows: {
    list: (params: { status?: WorkflowStatus | ""; limit?: number; offset?: number } = {}) =>
      request<WorkflowSummary[]>("/workflows", { params }),
    get: (id: string) => request<Workflow>(`/workflows/${id}`),
    create: (data: WorkflowCreate) => request<Workflow>("/workflows", { method: "POST", body: body(data) }),
    update: (id: string, data: WorkflowUpdate) =>
      request<Workflow>(`/workflows/${id}`, { method: "PUT", body: body(data) }),
    remove: (id: string) =>
      request<{ success: true; message: string }>(`/workflows/${id}`, { method: "DELETE" }),
    activate: (id: string) => request<Workflow>(`/workflows/${id}/activate`, { method: "POST" }),
    deactivate: (id: string) => request<Workflow>(`/workflows/${id}/deactivate`, { method: "POST" }),
  },

  executions: {
    list: (params: {
      workflow_id?: string
      status?: ExecutionStatus | ""
      limit?: number
      offset?: number
    } = {}) => request<import("./types").ExecutionSummary[]>("/executions", { params }),
    get: (id: string) => request<Execution>(`/executions/${id}`),
  },

  webhooks: {
    list: () => request<WebhookListItem[]>("/webhooks"),
    rotate: (id: string) =>
      request<{ id: string; token: string }>(`/webhooks/${id}/rotate`, { method: "POST" }),
  },

  integrations: {
    list: () => request<Integration[]>("/integrations"),
    get: (id: string) => request<Integration>(`/integrations/${id}`),
    create: (data: IntegrationCreate) =>
      request<Integration>("/integrations", { method: "POST", body: body(data) }),
    update: (id: string, data: IntegrationUpdate) =>
      request<Integration>(`/integrations/${id}`, { method: "PUT", body: body(data) }),
    remove: (id: string) =>
      request<{ success: true; message: string }>(`/integrations/${id}`, { method: "DELETE" }),
  },

  actions: {
    catalog: () => request<{ actions: string[] }>("/actions"),
    testHttp: (data: HttpActionRequest) =>
      request<HttpActionResult>("/actions/http", { method: "POST", body: body(data) }),
  },
}

