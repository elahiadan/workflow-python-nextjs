import { NextResponse } from "next/server"

import { API_BASE_URL } from "@/lib/api/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    const data = (await res.json()) as { status: string }
    return NextResponse.json(
      { status: data.status, api: res.ok ? "ok" : "down" },
      { status: 200 },
    )
  } catch {
    return NextResponse.json({ status: "unreachable", api: "down" }, { status: 200 })
  }
}
