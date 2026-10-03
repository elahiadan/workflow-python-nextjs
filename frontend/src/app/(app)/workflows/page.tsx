import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { WorkflowList } from "./workflow-list"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Workflows" }

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Every automation you own, with its trigger, steps and run history.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/workflows/new" />}>
          <Plus className="size-4" aria-hidden />
          New workflow
        </Button>
      </div>
      <WorkflowList />
    </div>
  )
}
