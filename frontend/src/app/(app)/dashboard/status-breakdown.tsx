"use client"

import { useQuery } from "@tanstack/react-query"

import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/api/browser"
import { cn } from "@/lib/utils"
import type { ExecutionStatus } from "@/lib/api/types"

const BUCKETS: { status: ExecutionStatus; label: string; color: string }[] = [
  { status: "success", label: "Success", color: "bg-emerald-500" },
  { status: "failed", label: "Failed", color: "bg-red-500" },
  { status: "running", label: "Running", color: "bg-blue-500" },
  { status: "pending", label: "Pending", color: "bg-slate-400" },
]

export function StatusBreakdown() {
  const { data, isPending } = useQuery({
    queryKey: ["executions", { limit: 200, offset: 0 }],
    queryFn: () => apiClient.executions.list({ limit: 200, offset: 0 }),
    refetchInterval: 20_000,
  })

  if (isPending) return <Skeleton className="h-28 w-full rounded-lg" />

  const items = data ?? []
  const total = items.length
  const counts = BUCKETS.map((b) => ({
    ...b,
    count: items.filter((e) => e.status === b.status).length,
  }))

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No runs yet</p>
  }

  return (
    <div className="space-y-3">
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={counts.map((c) => `${c.count} ${c.label}`).join(", ")}
      >
        {counts
          .filter((c) => c.count > 0)
          .map((c) => (
            <div
              key={c.status}
              className={cn("h-full transition-all", c.color)}
              style={{ width: `${(c.count / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {counts.map((c) => (
          <li key={c.status} className="flex items-center gap-2 text-sm">
            <span className={cn("size-2 shrink-0 rounded-full", c.color)} aria-hidden />
            <span className="text-muted-foreground">{c.label}</span>
            <span className="ml-auto font-medium tabular-nums">{c.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
