"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OPERATORS, getOperator } from "@/lib/api/catalog"
import type { DraftStep } from "@/lib/builder/draft"
import type { ConditionOperator } from "@/lib/api/types"

/** Helper that offers the {{dotted.path}} template syntax inline. */
function TemplateHint({ field }: { field: string }) {
  const [open, setOpen] = useState(false)
  const example = field.trim() || "order.total"
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-primary hover:underline"
      >
        {open ? "Hide" : "Use"} a value from the trigger payload
      </button>
      {open && (
        <p className="rounded-md bg-muted/70 px-2 py-1.5 text-[11px] text-muted-foreground">
          Comparing{" "}
          <code className="font-mono text-foreground">{example}</code> against{" "}
          <code className="font-mono text-foreground">value</code> reads the raw trigger payload
          using a dotted path. Wrap the same path in{" "}
          <code className="font-mono text-foreground">{"{{ }}"}</code> in an action to resolve it
          at run time.
        </p>
      )}
    </div>
  )
}

export function ConditionEditor({
  step,
  onChange,
}: {
  step: DraftStep
  onChange: (config: Record<string, unknown>) => void
}) {
  const config = step.config
  const operator = getOperator(String(config.operator ?? "=="))

  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value })
  }

  function setOperator(next: string) {
    // Drop the value when switching to a unary operator, and coerce the shape
    // for list operators so the backend gets a usable payload.
    const def = getOperator(next)
    const updated: Record<string, unknown> = { ...config, operator: next as ConditionOperator }
    if (def.unary) {
      delete updated.value
    } else if (def.expectsList) {
      updated.value = Array.isArray(config.value) ? config.value : splitList(config.value)
    } else {
      updated.value = config.value ?? ""
    }
    onChange(updated)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
      <div className="space-y-2">
        <Label htmlFor={`${step.key}-field`}>Field path</Label>
        <Input
          id={`${step.key}-field`}
          placeholder="order.total"
          spellCheck={false}
          className="font-mono text-xs"
          value={String(config.field ?? "")}
          onChange={(e) => set("field", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${step.key}-operator`}>Operator</Label>
        <Select value={String(config.operator ?? "==")} onValueChange={(v) => v && setOperator(v)}>
          <SelectTrigger id={`${step.key}-operator`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  <span className="font-mono text-xs">{op.value}</span>
                  <span className="ml-2 text-muted-foreground">{op.label}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {!operator.unary && (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${step.key}-value`}>
            Compare with
            {operator.expectsList && (
              <span className="ml-1 font-normal text-muted-foreground">(comma separated)</span>
            )}
          </Label>
          {operator.expectsList ? (
            <Input
              id={`${step.key}-value`}
              placeholder="pending, paid, shipped"
              className="font-mono text-xs"
              value={
                Array.isArray(config.value)
                  ? config.value.join(", ")
                  : String(config.value ?? "")
              }
              onChange={(e) =>
                set("value", e.target.value.trim() ? splitList(e.target.value) : [])
              }
            />
          ) : (
            <Input
              id={`${step.key}-value`}
              placeholder={operator.expectsNumber ? "100" : "expected value"}
              className="font-mono text-xs"
              value={
                config.value === undefined || config.value === null
                  ? ""
                  : String(config.value)
              }
              onChange={(e) => {
                const raw = e.target.value
                set("value", operator.expectsNumber ? numericOrString(raw) : raw)
              }}
            />
          )}
        </div>
      )}

      <div className="sm:col-span-2">
        <TemplateHint field={String(config.field ?? "")} />
      </div>

      <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 sm:col-span-2">
        <strong className="font-medium">Note:</strong> there is no else branch. When this condition
        evaluates to false the run stops immediately and remaining steps are recorded as{" "}
        <em>skipped</em>, even though the execution itself is marked successful.
      </p>
    </div>
  )
}

function splitList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v))
  return String(raw ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

function numericOrString(raw: string): string | number {
  if (raw.trim() === "") return ""
  const n = Number(raw)
  return Number.isFinite(n) ? n : raw
}
