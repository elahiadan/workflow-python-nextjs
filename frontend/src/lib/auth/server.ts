import "server-only"

import { betterAuth } from "better-auth"
import { createAuthEndpoint, APIError } from "better-auth/api"
import { setSessionCookie, deleteSessionCookie } from "better-auth/cookies"
import * as z from "zod"

import { API_BASE_URL, API_PREFIX } from "@/lib/api/client"
import { clearTokenPair, getTokenPair, setTokenPair } from "@/lib/api/tokens"
import type { AuthResponse, User } from "@/lib/api/types"

/** Upstream error envelope, so the UI can show the backend's own wording. */
class UpstreamError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

async function callAuth(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new UpstreamError(
      data?.error?.code ?? "UNKNOWN",
      data?.message ?? "Authentication failed",
      data?.error?.details,
    )
  }
  return data as AuthResponse
}

/**
 * The FastAPI user is the source of truth. Better Auth runs in stateless mode
 * (no database) purely to own the httpOnly session cookie, so we mirror the
 * upstream user into a synthetic Better Auth user record.
 */
function toAuthUser(user: User) {
  return {
    id: user.id,
    name: user.full_name || user.email.split("@")[0],
    email: user.email,
    emailVerified: true,
    image: null as string | null,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.created_at),
  }
}

/**
 * `setSessionCookie` is typed to take the same endpoint context the plugin
 * handlers receive, so we derive the type from it instead of importing
 * `GenericEndpointContext` out of Better Auth's internal package.
 */
type EndpointContext = Parameters<typeof setSessionCookie>[0]

async function establishSession(ctx: EndpointContext, user: User) {
  const session = await ctx.context.internalAdapter.createSession(user.id)
  await setSessionCookie(ctx, { session, user: toAuthUser(user) })
  return session
}

function workflowAuth() {
  return {
    id: "workflow-auth",
    endpoints: {
      signInWorkflow: createAuthEndpoint(
        "/workflow/sign-in",
        {
          method: "POST",
          body: z.object({
            email: z.string().email(),
            password: z.string().min(1),
          }),
        },
        async (ctx) => {
          const { email, password } = ctx.body
          let result: AuthResponse
          try {
            result = await callAuth("/auth/login", { email, password })
          } catch (err) {
            if (err instanceof UpstreamError) {
              throw new APIError("UNAUTHORIZED", {
                message: err.message,
                body: { code: err.code, details: err.details },
              })
            }
            throw err
          }

          await setTokenPair(result.tokens)
          await establishSession(ctx, result.user)
          return ctx.json({ user: result.user })
        },
      ),

      signUpWorkflow: createAuthEndpoint(
        "/workflow/sign-up",
        {
          method: "POST",
          body: z.object({
            email: z.string().email(),
            password: z.string().min(8, "Password must be at least 8 characters"),
            name: z.string().optional(),
          }),
        },
        async (ctx) => {
          const { email, password, name } = ctx.body
          let result: AuthResponse
          try {
            result = await callAuth("/auth/register", {
              email,
              password,
              ...(name ? { full_name: name } : {}),
            })
          } catch (err) {
            if (err instanceof UpstreamError) {
              throw new APIError("BAD_REQUEST", {
                message: err.message,
                body: { code: err.code, details: err.details },
              })
            }
            throw err
          }

          await setTokenPair(result.tokens)
          await establishSession(ctx, result.user)
          return ctx.json({ user: result.user })
        },
      ),

      signOutWorkflow: createAuthEndpoint(
        "/workflow/sign-out",
        { method: "POST" },
        async (ctx) => {
          const pair = await getTokenPair()
          if (pair) {
            await fetch(`${API_BASE_URL}${API_PREFIX}/auth/logout`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${pair.access_token}`,
              },
              body: JSON.stringify({ refresh_token: pair.refresh_token }),
              cache: "no-store",
            }).catch(() => undefined)
          }
          await clearTokenPair()
          deleteSessionCookie(ctx)
          return ctx.json({ success: true })
        },
      ),
    },
  }
}

const workflowAuthPlugin = workflowAuth()

export const auth = betterAuth({
  appName: "Workflow",
  // Stateless: no `database` key, so Better Auth keeps the session in a signed
  // cookie instead of a table. FastAPI remains the only source of truth.
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24,
      strategy: "jwe",
      refreshCache: true,
    },
  },
  advanced: {
    cookiePrefix: "workflow",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"],
  plugins: [workflowAuthPlugin],
})

export type Session = typeof auth.$Infer.Session
export type WorkflowAuthPlugin = typeof workflowAuthPlugin
