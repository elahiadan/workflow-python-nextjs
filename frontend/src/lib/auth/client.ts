"use client"

import { createAuthClient } from "better-auth/react"
import type { WorkflowAuthPlugin } from "./server"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? undefined,
  plugins: [
    {
      id: "workflow-auth",
      $InferServerPlugin: {} as WorkflowAuthPlugin,
    },
  ],
})

export const { useSession, getSession, signOut } = authClient

/** Server plugin actions are exposed under `authClient.workflow.*`. */
export const workflowAuth = authClient.workflow
