import "server-only"

import { createHash } from "node:crypto"
import { cookies } from "next/headers"
import { EncryptJWT, jwtDecrypt } from "jose"

import type { TokenPair } from "./types"

/**
 * The FastAPI access/refresh token pair is stored in a single httpOnly,
 * encrypted cookie. It is never exposed to client JavaScript — every upstream
 * call happens in a Route Handler or Server Component that reads it here.
 */

const COOKIE_NAME = "wf_tokens"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

/** A256GCM requires exactly 32 bytes, so we hash whatever the env var holds. */
function getKey(): Uint8Array {
  const secret = process.env.TOKEN_ENCRYPTION_KEY
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Add it to frontend/.env.local (see .env.example).",
    )
  }
  return new Uint8Array(createHash("sha256").update(secret).digest())
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  }
}

export async function setTokenPair(tokens: TokenPair): Promise<void> {
  const jwt = await new EncryptJWT({ ...tokens })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .encrypt(getKey())

  const store = await cookies()
  store.set(COOKIE_NAME, jwt, cookieOptions())
}

export async function getTokenPair(): Promise<TokenPair | null> {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return null

  try {
    const { payload } = await jwtDecrypt(raw, getKey())
    if (!payload.access_token || !payload.refresh_token) return null
    return {
      access_token: String(payload.access_token),
      refresh_token: String(payload.refresh_token),
      token_type: String(payload.token_type ?? "bearer"),
    }
  } catch {
    return null
  }
}

export async function getAccessToken(): Promise<string | null> {
  return (await getTokenPair())?.access_token ?? null
}

export async function clearTokenPair(): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 })
}
