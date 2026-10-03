"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  MoreHorizontal,
  Pencil,
  Play,
  Power,
  Square,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { EmptyState, ErrorState } from "@/components/empty-state"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api/browser"
import { errorMessage } from "@/lib/api/error"
import { WORKFLOW_STATUSES } from "@/lib/api/catalog"
import { workflowTone } from "@/lib/status"
import { relativeTime, truncate } from "@/lib/format"
import type { WorkflowStatus, WorkflowSummary } from "@/lib/api/types"
import { useState } from "react"

const STATUS_FILTERS: { value: WorkflowStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...WORKFLOW_STATUSES.map((s) => ({ value: s as WorkflowStatus | "all", label: s })),
]

export function WorkflowList() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<WorkflowStatus | "all">("all")
  const [pendingDelete, setPendingDelete] = useState<WorkflowSummary | null>(null)

  const workflows = useQuery({
    queryKey: ["workflows", { status }],
    queryFn: () =>
      apiClient.workflows.list({ status: status === "all" ? "" : status, limit: 200 }),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["workflows"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }

  const activate = useMutation({
    mutationFn: (id: string) => apiClient.workflows.activate(id),
    onSuccess: () => {
      toast.success("Workflow activated")
      invalidate()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => apiClient.workflows.deactivate(id),
    onSuccess: () => {
      toast.success("Workflow deactivated")
      invalidate()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.workflows.remove(id),
    onSuccess: () => {
      toast.success("Workflow deleted")
      setPendingDelete(null)
      invalidate()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const items = workflows.data ?? []

  return (
    <div className="space-y-4">
      <Tabs value={status} onValueChange={(v) => setStatus(v as WorkflowStatus | "all")}>
        <TabsList>
          {STATUS_FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="capitalize">
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {workflows.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : workflows.isError ? (
        <ErrorState message={errorMessage(workflows.error)} onRetry={workflows.refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          title={status === "all" ? "No workflows yet" : `No ${status} workflows`}
          description={
            status === "all"
              ? "Create your first automation to start receiving events and running actions."
              : "Try a different status filter."
          }
          action={
            status === "all" ? (
              <Button nativeButton={false} render={<Link href="/workflows/new" />}>
                New workflow
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%]">Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Trigger</TableHead>
                <TableHead className="hidden lg:table-cell">Version</TableHead>
                <TableHead className="hidden lg:table-cell">Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((wf) => (
                <TableRow key={wf.id} className="group">
                  <TableCell className="max-w-0">
                    <Link
                      href={`/workflows/${wf.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {wf.name}
                    </Link>
                    {wf.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {truncate(wf.description, 90)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={workflowTone(wf.status)} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="font-mono text-[11px] capitalize">
                      webhook
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell tabular-nums text-muted-foreground">
                    v{wf.version}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {relativeTime(wf.updated_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${wf.name}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          className="pl-1.5"
                          render={<Link href={`/workflows/${wf.id}`} />}
                        >
                          <Pencil className="size-4" aria-hidden />
                          Edit
                        </DropdownMenuItem>
                        {wf.status === "active" ? (
                          <DropdownMenuItem
                            className="pl-1.5"
                            onClick={() => deactivate.mutate(wf.id)}
                          >
                            <Power className="size-4" aria-hidden />
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="pl-1.5"
                            onClick={() => activate.mutate(wf.id)}
                          >
                            <Play className="size-4" aria-hidden />
                            Activate
                          </DropdownMenuItem>
                        )}
                        {wf.status !== "archived" && (
                          <DropdownMenuItem
                            className="pl-1.5"
                            onClick={() =>
                              apiClient.workflows
                                .update(wf.id, { status: "archived" })
                                .then(() => {
                                  toast.success("Workflow archived")
                                  invalidate()
                                })
                                .catch((e) => toast.error(errorMessage(e)))
                            }
                          >
                            <Square className="size-4" aria-hidden />
                            Archive
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          className="pl-1.5"
                          onClick={() => setPendingDelete(wf)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the workflow, its steps, webhooks, executions and logs.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Deleting…" : "Delete workflow"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
