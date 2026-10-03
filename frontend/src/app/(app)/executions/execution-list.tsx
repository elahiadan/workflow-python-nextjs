"use client"

import { useQuery } from "@tanstack/react-query"
import { Cable, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { StatusBadge } from "@/components/status-badge"
import { EmptyState, ErrorState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiClient } from "@/lib/api/browser"
import { errorMessage } from "@/lib/api/error"
import { formatDate, formatDuration } from "@/lib/format"
import { executionTone } from "@/lib/status"
import type { ExecutionStatus, WorkflowSummary } from "@/lib/api/types"

const PAGE_SIZE = 25
const STATUSES: (ExecutionStatus | "all")[] = [
  "all",
  "running",
  "success",
  "failed",
  "pending",
]

export function ExecutionList({
  workflows = [],
  fixedWorkflowId,
}: {
  workflows?: WorkflowSummary[]
  fixedWorkflowId?: string
}) {
  const [status, setStatus] = useState<ExecutionStatus | "all">("all")
  const [workflowId, setWorkflowId] = useState<string>(fixedWorkflowId ?? "all")
  const [page, setPage] = useState(0)

  const effectiveWorkflow = fixedWorkflowId ?? (workflowId === "all" ? undefined : workflowId)

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["executions", { status, workflowId: effectiveWorkflow, page }],
    queryFn: () =>
      apiClient.executions.list({
        status: status === "all" ? "" : status,
        workflow_id: effectiveWorkflow,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    // Keep polling while anything is still in flight.
    refetchInterval: (query) => {
      const items = query.state.data ?? []
      const inFlight = items.some(
        (e) => e.status === "running" || e.status === "pending",
      )
      return inFlight ? 2000 : 15000
    },
  })

  const items = data ?? []
  const hasNext = items.length === PAGE_SIZE

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!fixedWorkflowId && (
          <Select
            value={workflowId}
            onValueChange={(v) => {
              if (!v) return
              setWorkflowId(v)
              setPage(0)
            }}
          >
            <SelectTrigger className="w-[240px]" aria-label="Filter by workflow">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workflows</SelectItem>
              {workflows.map((w) => (
                <SelectItem key={w.id} value={w.id} className="truncate">
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={status}
          onValueChange={(v) => {
            if (!v) return
            setStatus(v as ExecutionStatus | "all")
            setPage(0)
          }}
        >
          <SelectTrigger className="w-[160px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s === "all" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Cable}
          title="No executions found"
          description={
            status === "all" && !effectiveWorkflow
              ? "Runs appear here as soon as a workflow is triggered."
              : "Try clearing the filters."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Execution</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Trigger</TableHead>
                <TableHead className="hidden md:table-cell">Error</TableHead>
                <TableHead className="hidden lg:table-cell">Duration</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((ex) => (
                <TableRow key={ex.id}>
                  <TableCell>
                    <Link
                      href={`/executions/${ex.id}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {ex.id.slice(0, 8)}…
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={executionTone(ex.status)} />
                  </TableCell>
                  <TableCell className="hidden capitalize sm:table-cell text-muted-foreground">
                    {ex.trigger_type}
                  </TableCell>
                  <TableCell className="hidden max-w-64 md:table-cell">
                    {ex.error ? (
                      <span className="line-clamp-1 text-xs text-destructive" title={ex.error}>
                        {ex.error}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden tabular-nums lg:table-cell text-muted-foreground">
                    {formatDuration(ex.duration_ms)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDate(ex.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(page > 0 || hasNext) && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page + 1}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-3.5" aria-hidden />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
