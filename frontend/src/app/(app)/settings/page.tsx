import type { Metadata } from "next"

import { AccountPanel } from "./account-panel"
import { SystemPanel } from "./system-panel"
import {
  actionApi,
  authApi,
  executionApi,
  userApi,
  webhookApi,
  workflowApi,
} from "@/lib/api/endpoints"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const [user, meAgain, workflows, executions, webhooks, actions] = await Promise.all([
    authApi.me().catch(() => null),
    // Same payload as /auth/me, kept as a second read path per the API.
    userApi.me().catch(() => null),
    workflowApi.list({ limit: 200 }).catch(() => []),
    executionApi.list({ limit: 200 }).catch(() => []),
    webhookApi.list().catch(() => []),
    actionApi.catalog().catch(() => ({ actions: [] })),
  ])

  const activeCount = workflows.filter((w) => w.status === "active").length

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account, this deployment and your webhook inventory.
        </p>
      </div>

      <AccountPanel user={user} agreesWithAltPath={meAgain?.id === user?.id} />
      <SystemPanel
        actionCount={actions.actions.length}
        activeWorkflowCount={activeCount}
        executionCount={executions.length}
        webhookCount={webhooks.length}
        workflowCount={workflows.length}
      />
    </div>
  )
}
