"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

import { CopyButton } from "@/components/copy-button"
import { cn } from "@/lib/utils"

type Entry = [string, unknown]

function isPrimitive(value: unknown) {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
}

function renderPrimitive(value: unknown) {
  if (value === null) return <span className="text-muted-foreground">null</span>
  if (value === undefined) return <span className="text-muted-foreground">undefined</span>
  switch (typeof value) {
    case "string":
      return <span className="text-emerald-600 dark:text-emerald-400">&quot;{value}&quot;</span>
    case "number":
      return <span className="text-blue-600 dark:text-blue-400">{value}</span>
    case "boolean":
      return <span className="text-amber-600 dark:text-amber-400">{String(value)}</span>
    default:
      return <span className="text-muted-foreground">{String(value)}</span>
  }
}

function Node({ name, value, depth }: { name: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 1)

  if (isPrimitive(value)) {
    return (
      <div className="flex gap-2 py-0.5 pl-4" style={{ paddingLeft: depth * 12 }}>
        <span className="shrink-0 text-muted-foreground">{name}:</span>
        {renderPrimitive(value)}
      </div>
    )
  }

  const entries: Entry[] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded py-0.5 pr-2 text-left transition-colors hover:bg-muted/50"
        style={{ paddingLeft: depth * 12 }}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="text-muted-foreground">{name}</span>
        <span className="text-muted-foreground/60">
          {Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {open && (
        <div className="border-l border-border/60">
          {entries.length === 0 ? (
            <div
              className="py-0.5 pl-4 text-muted-foreground/70"
              style={{ paddingLeft: (depth + 1) * 12 + 20 }}
            >
              empty
            </div>
          ) : (
            entries.map(([key, child]) => (
              <Node key={key} name={key} value={child} depth={depth + 1} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function JsonViewer({
  data,
  className,
  emptyMessage = "No data",
}: {
  data: unknown
  className?: string
  emptyMessage?: string
}) {
  if (data === null || data === undefined) {
    return (
      <p className={cn("px-1 py-2 text-sm text-muted-foreground", className)}>{emptyMessage}</p>
    )
  }

  if (isPrimitive(data)) {
    return <div className="py-1 font-mono text-xs">{renderPrimitive(data)}</div>
  }

  const entries: Entry[] = Array.isArray(data)
    ? data.map((v, i) => [String(i), v])
    : Object.entries(data as Record<string, unknown>)

  if (entries.length === 0) {
    return (
      <p className={cn("px-1 py-2 text-sm text-muted-foreground", className)}>{emptyMessage}</p>
    )
  }

  return (
    <div className={cn("relative font-mono text-xs", className)}>
      <CopyButton
        value={JSON.stringify(data, null, 2)}
        label="Copy JSON"
        size="sm"
        variant="secondary"
        className="absolute right-0 top-0 z-10"
      />
      <div className="space-y-0.5">
        {entries.map(([key, value]) => (
          <Node key={key} name={key} value={value} depth={0} />
        ))}
      </div>
    </div>
  )
}
