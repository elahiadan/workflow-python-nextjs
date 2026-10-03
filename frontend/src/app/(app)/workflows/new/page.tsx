import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { WorkflowBuilder } from "@/components/builder/workflow-builder"
import { Button } from "@/components/ui/button"
import { emptyDraft } from "@/lib/builder/draft"

export const metadata: Metadata = { title: "New workflow" }

export default function NewWorkflowPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/workflows" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New workflow</h1>
        <p className="text-sm text-muted-foreground">
          Choose a trigger, then add the steps to run. New workflows start as a draft — activate
          them when you are ready to receive events.
        </p>
      </div>

      <WorkflowBuilder initial={emptyDraft()} />
    </div>
  )
}
