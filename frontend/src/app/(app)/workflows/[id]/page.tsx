import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { WorkflowDetail } from "./workflow-detail"
import { ErrorState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { workflowApi } from "@/lib/api/endpoints"
import { ApiError } from "@/lib/api/error"

export const metadata: Metadata = { title: "Workflow" }

export default async function WorkflowDetailPage({
  params,
}: PageProps<"/workflows/[id]">) {
  const { id } = await params

  let workflow
  try {
    workflow = await workflowApi.get(id)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    return (
      <div className="space-y-4">
        <Button variant="ghost" nativeButton={false} render={<Link href="/workflows" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to workflows
        </Button>
        <ErrorState
          title="Could not load this workflow"
          message={err instanceof Error ? err.message : "Unknown error"}
        />
      </div>
    )
  }

  return <WorkflowDetail workflow={workflow} />
}
