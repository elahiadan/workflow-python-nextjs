import { NextResponse } from "next/server"

import { apiFetch, ApiError } from "@/lib/api/client"
import { getTokenPair } from "@/lib/api/tokens"

/**
 * Same-origin proxy to the FastAPI backend.
 *
 * The browser talks to `/api/wf/*` on the Next.js origin, which attaches the
 * httpOnly `wf_tokens` cookie. That keeps the JWT out of client JS and means
 * the backend never needs CORS.
 */
export async function handler(
  request: Request,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params
  const search = new URL(request.url).search

  if (!(await getTokenPair())) {
    return NextResponse.json(
      {
        success: false,
        message: "Not authenticated",
        error: { code: "UNAUTHORIZED" },
      },
      { status: 401 },
    )
  }

  const method = request.method
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE"
  const body = hasBody ? await request.text() : undefined

  try {
    const data = await apiFetch(`/${path.join("/")}${search}`, {
      method,
      body: body && body.length > 0 ? body : undefined,
    })
    return NextResponse.json(data ?? null)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        {
          success: false,
          message: err.message,
          error: { code: err.code, details: err.details },
        },
        { status: err.status },
      )
    }
    console.error("[proxy] unexpected error", err)
    return NextResponse.json(
      {
        success: false,
        message: "Could not reach the workflow API. Is the backend running?",
        error: { code: "UPSTREAM_UNAVAILABLE" },
      },
      { status: 502 },
    )
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
