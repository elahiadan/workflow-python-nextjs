"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, Pause, Play } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { WorkflowBuilder } from "@/components/builder/workflow-builder"
import { WebhookPanel } from "@/components/builder/webhook-panel"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient } from "@/lib/api/browser"
import { errorMessage } from "@/lib/api/error"
import { formatDate, formatDuration } from "@/lib/format"
import { executionTone, workflowTone } from "@/lib/status"
import { draftFromWorkflow } from "@/lib/builder/draft"
import type { Workflow } from "@/lib/api/types"

export function WorkflowDetail({ workflow: initial }: { workflow: Workflow }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["workflow", initial.id] })
    queryClient.invalidateQueries({ queryKey: ["workflows"] })
  }

  const activate = useMutation({
    mutationFn: () => apiClient.workflows.activate(initial.id),
    onSuccess: () => {
      toast.success("Workflow activated")
      invalidate()
      router.refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const deactivate = useMutation({
    mutationFn: () => apiClient.workflows.deactivate(initial.id),
    onSuccess: () => {
      toast.success("Workflow deactivated")
      invalidate()
      router.refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const archive = useMutation({
    mutationFn: () => apiClient.workflows.update(initial.id, { status: "archived" }),
    onSuccess: () => {
      toast.success("Workflow archived")
      invalidate()
      router.refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{initial.name}</h1>
            <StatusBadge tone={workflowTone(initial.status)} />
            <span className="text-xs text-muted-foreground">v{initial.version}</span>
          </div>
          {initial.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{initial.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Created {formatDate(initial.created_at)} · last updated {formatDate(initial.updated_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {initial.status === "active" ? (
            <Button
              variant="outline"
              onClick={() => deactivate.mutate()}
              disabled={deactivate.isPending}
            >
              <Pause className="size-4" aria-hidden />
              Deactivate
            </Button>
          ) : (
            <Button onClick={() => activate.mutate()} disabled={activate.isPending}>
              <Play className="size-4" aria-hidden />
              Activate
            </Button>
          )}
          {initial.status !== "archived" && (
            <Button
              variant="outline"
              onClick={() => archive.mutate()}
              disabled={archive.isPending}
            >
              <Archive className="size-4" aria-hidden />
              Archive
            </Button>
          )}
        </div>
      </div>


      <Tabs defaultValue="builder" className="space-y-4">
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
          <WorkflowBuilder
            initial={draftFromWorkflow(initial)}
            workflowId={initial.id}
            key={initial.updated_at}
          />
        </TabsContent>

        <TabsContent value="webhook">
          <WebhookPanel workflow={initial} />
        </TabsContent>

        <TabsContent value="runs">
          <WorkflowRuns workflowId={initial.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function WorkflowRuns({ workflowId }: { workflowId: string }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["executions", { workflow_id: workflowId, limit: 25 }],
    queryFn: () => apiClient.executions.list({ workflow_id: workflowId, limit: 25 }),
    refetchInterval: 10_000,
  })

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={refetch} />

  const items = data ?? []
  if (items.length === 0) {
    return (
      <EmptyState
        title="No runs yet"
        description="Activate this workflow and send a test event to see executions."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Execution</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Trigger</TableHead>
            <TableHead className="hidden md:table-cell">Duration</TableHead>
            <TableHead className="hidden md:table-cell">Started</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((ex) => (
            <TableRow key={ex.id}>
              <TableCell className="font-mono text-xs">
                <Link href={`/executions/${ex.id}`} className="hover:underline">
                  {ex.id.slice(0, 8)}…
                </Link>
              </TableCell>
              <TableCell>
                <StatusBadge tone={executionTone(ex.status)} />
              </TableCell>
              <TableCell className="hidden sm:table-cell capitalize text-muted-foreground">
                {ex.trigger_type}
              </TableCell>
              <TableCell className="hidden md:table-cell tabular-nums text-muted-foreground">
                {formatDuration(ex.duration_ms)}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {formatDate(ex.started_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
