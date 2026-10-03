import { NextResponse } from "next/server"

import { API_BASE_URL, API_PREFIX } from "@/lib/api/client"

/**
 * Server-side passthrough for the public webhook ingest endpoint
 * (`POST /api/v1/webhooks/{token}`), which is unauthenticated by design.
 * Lets the UI fire a realistic test event without CORS or exposing the backend
 * origin to the browser.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Missing webhook token" },
      { status: 400 },
    )
  }

  const eventId = searchParams.get("eventId")
  const body = await request.text()

  try {
    const res = await fetch(`${API_BASE_URL}${API_PREFIX}/webhooks/${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(eventId ? { "X-Event-Id": eventId } : {}),
      },
      body: body || "{}",
    })

    const data = await res.json().catch(() => null)
    return NextResponse.json(data ?? {}, { status: res.status })
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not reach the workflow API" },
      { status: 502 },
    )
  }
}
