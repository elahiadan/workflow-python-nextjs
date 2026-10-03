import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Cable, Plus, Workflow as WorkflowIcon } from "lucide-react"

import { DashboardHeader, DashboardStats } from "./dashboard-stats"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RecentExecutions } from "./recent-executions"
import { StatusBreakdown } from "./status-breakdown"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardHeader />
      <DashboardStats />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>The last executions across all workflows.</CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/executions" />}
              >
                View all
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <RecentExecutions />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Run health</CardTitle>
              <CardDescription>Outcome distribution for recent executions.</CardDescription>
            </CardHeader>
            <CardContent>
              <StatusBreakdown />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Getting started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <StepLink
                href="/workflows/new"
                icon={Plus}
                title="Create a workflow"
                description="Pick a trigger, add conditions and actions."
              />
              <StepLink
                href="/executions"
                icon={Cable}
                title="Inspect executions"
                description="See every step, input, output and log line."
              />
              <StepLink
                href="/integrations"
                icon={WorkflowIcon}
                title="Connect integrations"
                description="Store Slack, email and HTTP credentials once."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StepLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-border/70 p-3 transition-colors hover:border-primary/40 hover:bg-accent/50"
    >
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight
        className="ml-auto mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  )
}
