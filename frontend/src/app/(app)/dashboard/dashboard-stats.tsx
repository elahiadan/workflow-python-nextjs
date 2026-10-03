"use client"

import { useQuery } from "@tanstack/react-query"

import { StatCard } from "@/components/stat-card"
import { apiClient } from "@/lib/api/browser"
import {
  Activity,
  CheckCircle2,
  CircleSlash,
  Workflow as WorkflowIcon,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"

export function DashboardStats() {
  const workflows = useQuery({
    queryKey: ["workflows", "stats"],
    queryFn: () => apiClient.workflows.list({ limit: 200 }),
  })
  const executions = useQuery({
    queryKey: ["executions", "stats"],
    queryFn: () => apiClient.executions.list({ limit: 200 }),
    refetchInterval: 15_000,
  })

  const wf = workflows.data ?? []
  const ex = executions.data ?? []

  const active = wf.filter((w) => w.status === "active").length
  const draft = wf.filter((w) => w.status === "draft").length
  const success = ex.filter((e) => e.status === "success").length
  const failed = ex.filter((e) => e.status === "failed").length
  const inFlight = ex.filter((e) => e.status === "running" || e.status === "pending").length
  const finished = success + failed
  const rate = finished > 0 ? Math.round((success / finished) * 100) : null

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Workflows"
        value={formatNumber(wf.length)}
        hint={`${active} active · ${draft} draft`}
        icon={WorkflowIcon}
        loading={workflows.isPending}
      />
      <StatCard
        label="Runs"
        value={formatNumber(ex.length)}
        hint={inFlight > 0 ? `${inFlight} in flight` : "No runs in flight"}
        icon={Activity}
        tone="info"
        loading={executions.isPending}
      />
      <StatCard
        label="Success rate"
        value={rate === null ? "—" : `${rate}%`}
        hint={rate === null ? "No finished runs yet" : `${success} of ${finished} finished`}
        icon={CheckCircle2}
        tone="success"
        loading={executions.isPending}
      />
      <StatCard
        label="Failed"
        value={formatNumber(failed)}
        hint={failed > 0 ? "Needs attention" : "All clear"}
        icon={failed > 0 ? XCircle : CircleSlash}
        tone={failed > 0 ? "danger" : "default"}
        loading={executions.isPending}
      />
    </div>
  )
}

export function DashboardHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          A live view of your automations and their latest runs.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/workflows" />}>
          Browse workflows
        </Button>
        <Button nativeButton={false} render={<Link href="/workflows/new" />}>
          New workflow
        </Button>
      </div>
    </div>
  )
}
