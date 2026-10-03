import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import {
  ExecutionLogs,
  StepTimeline,
  TriggerPayload,
} from "./execution-panels"
import { CopyButton } from "@/components/copy-button"
import { ErrorState } from "@/components/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { executionApi } from "@/lib/api/endpoints"
import { ApiError } from "@/lib/api/error"
import { formatDate, formatDuration } from "@/lib/format"
import { executionTone } from "@/lib/status"

export const metadata: Metadata = { title: "Execution" }

export default async function ExecutionDetailPage({
  params,
}: PageProps<"/executions/[id]">) {
  const { id } = await params

  let execution
  try {
    execution = await executionApi.get(id)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    return (
      <div className="space-y-4">
        <Button variant="ghost" nativeButton={false} render={<Link href="/executions" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to executions
        </Button>
        <ErrorState
          title="Could not load this execution"
          message={err instanceof Error ? err.message : "Unknown error"}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/executions" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to executions
        </Button>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-lg font-semibold tracking-tight">{execution.id}</h1>
          <StatusBadge tone={executionTone(execution.status)} />
          <CopyButton value={execution.id} label="Copy id" size="sm" variant="secondary" />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="capitalize">Trigger: {execution.trigger_type}</span>
          <span>Duration: {formatDuration(execution.duration_ms)}</span>
          <span>Started: {formatDate(execution.started_at)}</span>
          <Link
            href={`/workflows/${execution.workflow_id}`}
            className="text-primary hover:underline"
          >
            View workflow
          </Link>
        </div>

        {execution.error && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
            {execution.error}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <StepTimeline executionId={execution.id} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <ExecutionLogs executionId={execution.id} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Trigger payload</CardTitle>
          </CardHeader>
          <CardContent>
            <TriggerPayload executionId={execution.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
