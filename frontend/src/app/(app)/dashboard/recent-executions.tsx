"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { StatusBadge } from "@/components/status-badge"
import { EmptyState, ErrorState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api/browser"
import { errorMessage } from "@/lib/api/error"
import { formatDuration, relativeTime } from "@/lib/format"
import { executionTone } from "@/lib/status"
import { Cable } from "lucide-react"

export function RecentExecutions() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["executions", { limit: 8, offset: 0 }],
    queryFn: () => apiClient.executions.list({ limit: 8, offset: 0 }),
    refetchInterval: 10_000,
  })

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) return <ErrorState message={errorMessage(error)} onRetry={refetch} />

  const items = data ?? []
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Cable}
        title="No runs yet"
        description="Activate a workflow and fire its webhook to see executions here."
        className="border-0 py-10"
      />
    )
  }

  return (
    <ul className="divide-y divide-border/60">
      {items.map((ex) => (
        <li key={ex.id}>
          <Link
            href={`/executions/${ex.id}`}
            className="flex items-center gap-3 py-2.5 transition-colors hover:bg-accent/40"
          >
            <StatusBadge tone={executionTone(ex.status)} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs text-muted-foreground">
                {ex.workflow_id.slice(0, 8)}…
              </p>
            </div>
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
              {ex.trigger_type}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatDuration(ex.duration_ms)}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {relativeTime(ex.created_at)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
