import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  loading,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon: LucideIcon
  tone?: "default" | "success" | "warning" | "danger" | "info"
  loading?: boolean
  className?: string
}) {
  const tones = {
    default: "text-muted-foreground bg-muted",
    success: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    warning: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    danger: "text-destructive bg-destructive/10",
    info: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-16" />
          ) : (
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          )}
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
