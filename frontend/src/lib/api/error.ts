import type { ApiErrorBody } from "./types"

/**
 * Isomorphic wrapper around the backend's `{success,message,error}` envelope,
 * so the same `err.code` / `err.message` handling works in Server Components and
 * in the browser.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || "Request failed")
    this.name = "ApiError"
    this.status = status
    this.code = body.error?.code ?? "UNKNOWN"
    this.details = body.error?.details
  }
}

/** Best-effort human message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Something went wrong"
}
