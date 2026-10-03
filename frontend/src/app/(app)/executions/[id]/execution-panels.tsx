"use client"

import { useQuery } from "@tanstack/react-query"
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import { JsonViewer } from "@/components/json-viewer"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { apiClient } from "@/lib/api/browser"
import { formatDate, formatDuration, formatTime } from "@/lib/format"
import { stepTone } from "@/lib/status"
import type { StepExecution, StepExecutionStatus } from "@/lib/api/types"

const ICONS: Record<StepExecutionStatus, LucideIcon> = {
  success: CheckCircle2,
  failed: XCircle,
  running: Loader2,
  pending: CircleDashed,
  skipped: MinusCircle,
}

const textToken = (className: string) =>
  className.split(" ").find((t) => t.startsWith("text-")) ?? "text-muted-foreground"

function StepRow({ step, isLast }: { step: StepExecution; isLast: boolean }) {
  const tone = stepTone(step.status)
  const Icon = ICONS[step.status]
  const isError = step.status === "failed"

  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      {!isLast && (
        <div className="absolute top-6 left-[11px] h-full w-px bg-border" aria-hidden />
      )}
      <div
        className={`z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background ${textToken(tone.className)}`}
      >
        <Icon
          className={`size-3.5 ${step.status === "running" ? "animate-spin" : ""}`}
          aria-hidden
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {step.step_order + 1}. {step.action ?? step.step_type}
          </span>
          <StatusBadge tone={tone} />
          {step.attempt > 1 && (
            <Badge variant="outline" className="text-[11px]">
              attempt {step.attempt}/{step.max_attempts}
            </Badge>
          )}
          {step.duration_ms !== null && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDuration(step.duration_ms)}
            </span>
          )}
        </div>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatTime(step.started_at)}
          {step.completed_at && ` → ${formatTime(step.completed_at)}`}
        </p>

        {isError && step.error && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
            <p className="break-words font-mono text-xs text-destructive">{step.error}</p>
          </div>
        )}

        {(Object.keys(step.input_data).length > 0 ||
          Object.keys(step.output_data).length > 0) && (
          <Collapsible className="mt-2">
            <CollapsibleTrigger className="text-xs font-medium text-primary hover:underline">
              Inspect input and output
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 p-2">
                <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Input
                </p>
                <JsonViewer data={step.input_data} emptyMessage="No input recorded" />
              </div>
              <div className="rounded-lg border border-border/70 p-2">
                <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Output
                </p>
                <JsonViewer data={step.output_data} emptyMessage="No output recorded" />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  )
}

export function StepTimeline({ executionId }: { executionId: string }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["execution", executionId],
    queryFn: () => apiClient.executions.get(executionId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "running" || status === "pending" ? 1500 : false
    },
  })

  if (isPending) return <Skeleton className="h-48 w-full rounded-lg" />
  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Could not load execution"}
      </p>
    )
  }
  if (!data) return null

  const steps = data.step_executions
  // The engine records a false-condition run as a success and marks the
  // condition (and anything after it) skipped. Only explain it when there are
  // steps after the first skip that the user expected to run.
  const firstSkip = steps.findIndex((s) => s.status === "skipped")
  const stoppedEarly = data.status === "success" && firstSkip !== -1 && firstSkip < steps.length - 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Steps</CardTitle>
        {stoppedEarly && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-400">
            The run was stopped by a condition that evaluated false. The execution is recorded as{" "}
            <strong>success</strong> because the workflow did not fail — the remaining steps below
            were never attempted.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This workflow has no steps, so the run completed immediately.
          </p>
        ) : (
          steps.map((step, i) => (
            <StepRow key={step.id} step={step} isLast={i === steps.length - 1} />
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function ExecutionLogs({ executionId }: { executionId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["execution", executionId],
    queryFn: () => apiClient.executions.get(executionId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "running" || status === "pending" ? 1500 : false
    },
  })

  if (isPending) return <Skeleton className="h-40 w-full rounded-lg" />
  const logs = data?.logs ?? []
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">No log lines recorded.</p>
  }

  return (
    <ol className="space-y-1">
      {logs.map((log) => {
        const tone =
          log.level === "ERROR"
            ? "text-destructive"
            : log.level === "WARNING"
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
        return (
          <li key={log.id} className="flex gap-3 font-mono text-xs">
            <span className="shrink-0 tabular-nums text-muted-foreground/70">
              {formatTime(log.created_at)}
            </span>
            <span className={tone}>{log.level}</span>
            <span className="min-w-0 flex-1 break-words text-foreground">{log.message}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function TriggerPayload({ executionId }: { executionId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["execution", executionId],
    queryFn: () => apiClient.executions.get(executionId),
  })

  if (isPending) return <Skeleton className="h-40 w-full rounded-lg" />

  return (
    <div className="space-y-3">
      <JsonViewer data={data?.trigger_payload} emptyMessage="No trigger payload" />
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Trigger</dt>
          <dd className="capitalize">{data?.trigger_type ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Event ID</dt>
          <dd className="font-mono break-all">{data?.event_id ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Started</dt>
          <dd>{formatDate(data?.started_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Completed</dt>
          <dd>{formatDate(data?.completed_at)}</dd>
        </div>
      </dl>
    </div>
  )
}
