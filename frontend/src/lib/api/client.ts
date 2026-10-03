import "server-only"

import { ApiError } from "./error"
import { clearTokenPair, getTokenPair, setTokenPair } from "./tokens"

export const API_BASE_URL = (process.env.API_BASE_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
)

export const API_PREFIX = "/api/v1"

export { ApiError }

type UpstreamInit = RequestInit & { token?: string | null; skipRefresh?: boolean }

/** Refresh the access token once when the API answers 401. */
async function refreshAccessToken(): Promise<string | null> {
  const pair = await getTokenPair()
  if (!pair) return null

  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: pair.refresh_token }),
    cache: "no-store",
  })
  if (!res.ok) {
    await clearTokenPair()
    return null
  }

  const data = (await res.json()) as { access_token: string; token_type: string }
  await setTokenPair({ ...pair, access_token: data.access_token })
  return data.access_token
}

/**
 * Server-side call to the FastAPI backend. Adds the bearer token, transparently
 * refreshes once on 401 and normalises the `{success,message,error}` envelope
 * into an {@link ApiError}.
 */
export async function apiFetch<T>(path: string, init: UpstreamInit = {}): Promise<T> {
  const { token, skipRefresh, headers, ...rest } = init
  const accessToken = token ?? (await getTokenPair())?.access_token ?? null

  const send = (bearer: string | null) =>
    fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      ...rest,
      cache: "no-store",
      headers: {
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...headers,
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
    })

  let res = await send(accessToken)

  if (res.status === 401 && !skipRefresh && accessToken) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      res = await send(refreshed)
    } else {
      await clearTokenPair()
    }
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    throw new ApiError(res.status, {
      success: false,
      message: data?.message ?? `Request failed with status ${res.status}`,
      error: {
        code: data?.error?.code ?? "UNKNOWN",
        details: data?.error?.details,
      },
    })
  }

  return data as T
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
}
