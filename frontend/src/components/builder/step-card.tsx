"use client"

import {
  ChevronDown,
  ChevronRight,
  Copy,
  Settings2,
  Trash2,
} from "lucide-react"

import { ActionEditor } from "./action-editor"
import { ConditionEditor } from "./condition-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ACTIONS, getOperator } from "@/lib/api/catalog"
import { cn } from "@/lib/utils"
import type { DraftStep } from "@/lib/builder/draft"

export function StepCard({
  step,
  index,
  total,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: {
  step: DraftStep
  index: number
  total: number
  isFirst: boolean
  isLast: boolean
  onChange: (patch: Partial<DraftStep>) => void
  onRemove: () => void
  onDuplicate: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const isCondition = step.type === "condition"
  const operator = isCondition ? getOperator(String(step.config.operator ?? "==")) : null
  const actionLabel =
    !isCondition && step.action ? (ACTIONS[step.action]?.label ?? step.action) : "Action"

  const summary = isCondition
    ? `${String(step.config.field ?? "…")} ${operator?.value ?? "…"} ${
        operator?.unary ? "" : String(step.config.value ?? "")
      }`.trim()
    : (step.config.url as string) || (step.config.to as string) || (step.config.text as string) || "Not configured"

  return (
    <div className="relative">
      {!isFirst && (
        <div
          className="absolute -top-3 left-6 h-3 w-px bg-border"
          aria-hidden
        />
      )}

      <div
        className={cn(
          "rounded-xl border bg-card transition-colors",
          isCondition ? "border-amber-500/30" : "border-border/70",
        )}
      >
        <div className="flex items-center gap-2 p-3">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move step up"
              disabled={isFirst}
              onClick={() => onMove(-1)}
              className="text-muted-foreground"
            >
              <ChevronDown className="size-3.5 rotate-180" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move step down"
              disabled={isLast}
              onClick={() => onMove(1)}
              className="text-muted-foreground"
            >
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </div>

          <button
            type="button"
            onClick={() => onChange({ collapsed: !step.collapsed })}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={!step.collapsed}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
                isCondition
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-primary/10 text-primary",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">
                  {step.name || actionLabel}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px] uppercase",
                    isCondition &&
                      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                  )}
                >
                  {isCondition ? "condition" : actionLabel}
                </Badge>
              </span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                {summary}
              </span>
            </span>
            {step.collapsed ? (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
          </button>

          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Duplicate step"
              onClick={onDuplicate}
              className="text-muted-foreground"
            >
              <Copy className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete step"
              onClick={onRemove}
              disabled={total === 1}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        {!step.collapsed && (
          <>
            <Separator />
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor={`${step.key}-name`}>Step name</Label>
                <Input
                  id={`${step.key}-name`}
                  placeholder={isCondition ? "High-value order" : "Notify the sales channel"}
                  value={step.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                />
              </div>

              {isCondition ? (
                <ConditionEditor
                  step={step}
                  onChange={(config) => onChange({ config })}
                />
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={`${step.key}-action`}>Action type</Label>
                  <Select
                    value={step.action ?? "http_request"}
                    onValueChange={(value) => {
                      if (!value) return
                      const definition = ACTIONS[value]
                      const next: Record<string, unknown> = {}
                      // Seed sensible defaults from the action definition.
                      for (const field of definition?.fields ?? []) {
                        if (field.type === "string" && field.options) {
                          next[field.key] = field.options[0].value
                        } else if (field.type === "number" && field.key === "timeout") {
                          next[field.key] = 30
                        }
                      }
                      onChange({ action: value, config: next, name: "" })
                    }}
                  >
                    <SelectTrigger id={`${step.key}-action`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ACTIONS).map((definition) => (
                        <SelectItem key={definition.name} value={definition.name}>
                          {definition.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {step.type === "action" && (
                <ActionEditor
                  step={step}
                  onChange={({ config }) => onChange({ config })}
                />
              )}

              <details className="group rounded-lg border border-border/70">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <Settings2 className="size-3.5" aria-hidden />
                  Reliability
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {step.max_attempts} attempts · {step.timeout_seconds}s timeout
                  </span>
                </summary>
                <div className="grid gap-3 border-t border-border/70 p-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${step.key}-attempts`}>Max attempts</Label>
                    <Input
                      id={`${step.key}-attempts`}
                      type="number"
                      min={1}
                      max={10}
                      value={step.max_attempts}
                      onChange={(e) =>
                        onChange({ max_attempts: Number(e.target.value) || 1 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${step.key}-retry`}>Retry delay (s)</Label>
                    <Input
                      id={`${step.key}-retry`}
                      type="number"
                      min={0}
                      max={3600}
                      value={step.retry_delay_seconds}
                      onChange={(e) =>
                        onChange({ retry_delay_seconds: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${step.key}-timeout`}>Timeout (s)</Label>
                    <Input
                      id={`${step.key}-timeout`}
                      type="number"
                      min={1}
                      max={300}
                      value={step.timeout_seconds}
                      onChange={(e) =>
                        onChange({ timeout_seconds: Number(e.target.value) || 1 })
                      }
                    />
                  </div>
                </div>
              </details>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
