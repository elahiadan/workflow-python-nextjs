import type { Metadata } from "next"

import { ExecutionList } from "./execution-list"
import { workflowApi } from "@/lib/api/endpoints"

export const metadata: Metadata = { title: "Executions" }

export default async function ExecutionsPage() {
  const workflows = await workflowApi.list({ limit: 200 }).catch(() => [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Executions</h1>
        <p className="text-sm text-muted-foreground">
          Every run across your workflows, with per-step outcomes and logs.
        </p>
      </div>
      <ExecutionList workflows={workflows} />
    </div>
  )
}
