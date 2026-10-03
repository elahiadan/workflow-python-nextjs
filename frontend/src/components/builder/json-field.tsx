"use client"

import { Braces } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * Small JSON textarea used for action config values (headers, body, params).
 * Reports validity so the builder can block a save on malformed JSON.
 */
export function JsonField({
  id,
  label,
  value,
  onChange,
  placeholder = "{}",
  rows = 5,
  help,
  className,
}: {
  id: string
  label: string
  value: unknown
  onChange: (next: unknown) => void
  placeholder?: string
  rows?: number
  help?: string
  className?: string
}) {
  const serialized =
    value === undefined || value === null
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2)

  let invalid = false
  if (serialized.trim()) {
    try {
      JSON.parse(serialized)
    } catch {
      invalid = true
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span
          className={cn(
            "text-[11px] font-medium",
            invalid ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {invalid ? "Invalid JSON" : "JSON"}
        </span>
      </div>
      <Textarea
        id={id}
        rows={rows}
        spellCheck={false}
        placeholder={placeholder}
        value={serialized}
        aria-invalid={invalid}
        onChange={(e) => {
          const raw = e.target.value
          if (!raw.trim()) {
            onChange(undefined)
            return
          }
          try {
            onChange(JSON.parse(raw))
          } catch {
            onChange(raw)
          }
        }}
        className="font-mono text-xs"
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  )
}

export function JsonPreview({ value }: { value: unknown }) {
  if (value === undefined || value === null) {
    return <p className="text-xs text-muted-foreground">Not configured</p>
  }
  return (
    <pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-2 font-mono text-[11px]">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function BracesIcon() {
  return <Braces className="size-3.5" aria-hidden />
}
