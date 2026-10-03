"use client"

import { useQuery } from "@tanstack/react-query"
import { Activity, Loader2 } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Polls the Next.js health route, which in turn pings the FastAPI `/health`
 * endpoint. Keeps a persistent read on whether the backend is reachable.
 */
export function HealthIndicator() {
  const { data, isPending } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health")
      if (!res.ok) throw new Error("unhealthy")
      return (await res.json()) as { status: string; api: string }
    },
    refetchInterval: 30_000,
    retry: false,
    staleTime: 20_000,
  })

  const healthy = data?.status === "ok" && data?.api === "ok"

  if (isPending) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
        <span className="group-data-[collapsible=icon]:hidden">Checking API…</span>
      </div>
    )
  }

  const row = (
    <div
      className={cn(
        "flex cursor-default items-center gap-2 px-2 py-1.5 text-xs",
        healthy ? "text-muted-foreground" : "text-destructive",
      )}
    >
      <Activity
        className={cn("size-3 shrink-0", healthy && "text-emerald-500")}
        aria-hidden
      />
      <span className="group-data-[collapsible=icon]:hidden">
        {healthy ? "API connected" : "API unreachable"}
      </span>
    </div>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={row} />
      <TooltipContent side="right">
        {healthy ? "Backend is healthy" : "Cannot reach the workflow API"}
      </TooltipContent>
    </Tooltip>
  )
}
