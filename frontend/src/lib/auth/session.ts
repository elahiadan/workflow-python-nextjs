import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "./server"
import { getTokenPair } from "@/lib/api/tokens"

/**
 * Reads the Better Auth session for Server Components. Returns null when there
 * is no valid session or when the upstream token cookie has gone missing.
 */
export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  if (!(await getTokenPair())) return null
  return session
}

export async function requireSession() {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}
