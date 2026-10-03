import { Boxes, Webhook as WebhookIcon, Workflow as WorkflowIcon, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Stat = { label: string; icon: LucideIcon; value: number; hint: string }

export function SystemPanel({
  workflowCount,
  activeWorkflowCount,
  webhookCount,
  actionCount,
  executionCount,
}: {
  workflowCount: number
  activeWorkflowCount: number
  webhookCount: number
  actionCount: number
  executionCount: number
}) {
  const stats: Stat[] = [
    {
      label: "Workflows",
      icon: WorkflowIcon,
      value: workflowCount,
      hint: "All statuses",
    },
    {
      label: "Active",
      icon: Zap,
      value: activeWorkflowCount,
      hint: "Receiving triggers",
    },
    {
      label: "Webhooks",
      icon: WebhookIcon,
      value: webhookCount,
      hint: "Unique tokens",
    },
    { label: "Actions", icon: Boxes, value: actionCount, hint: "In the catalog" },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="size-4" aria-hidden />
          This deployment
        </CardTitle>
        <CardDescription>Live counts read from the API on each page load.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border/70 p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <stat.icon className="size-3.5" aria-hidden />
                {stat.label}
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{stat.value}</dd>
              <dd className="text-[11px] text-muted-foreground">{stat.hint}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-xs text-muted-foreground">
          <span className="tabular-nums">{executionCount}</span> executions recorded (the executions
          page shows the most recent 200).
        </p>
      </CardContent>
    </Card>
  )
}
