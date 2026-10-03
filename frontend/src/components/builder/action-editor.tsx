"use client"

import {
  Globe,
  Mail,
  MessageSquare,
  Timer,
  type LucideIcon,
} from "lucide-react"

import { JsonField } from "@/components/builder/json-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ACTIONS, HTTP_METHODS } from "@/lib/api/catalog"
import { cn } from "@/lib/utils"
import type { DraftStep } from "@/lib/builder/draft"

const ICONS: Record<string, LucideIcon> = {
  Globe,
  Mail,
  MessageSquare,
  Timer,
}

export function ActionIcon({
  action,
  className,
}: {
  action: string | null
  className?: string
}) {
  const Icon: LucideIcon = (action !== null && ICONS[action]) || Globe
  return <Icon className={cn("size-4", className)} aria-hidden />
}

export function ActionEditor({
  step,
  onChange,
}: {
  step: DraftStep
  onChange: (patch: { config: Record<string, unknown> }) => void
}) {
  const action = step.action ?? "http_request"
  const definition = ACTIONS[action] ?? ACTIONS.http_request
  const config = step.config

  function set(key: string, value: unknown) {
    onChange({ config: { ...config, [key]: value } })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-background">
          <ActionIcon action={action} className="text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{definition.label}</p>
          <p className="text-xs text-muted-foreground">{definition.description}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {definition.fields.map((field) => {
          const id = `${step.key}-${field.key}`
          const value = config[field.key]

          if (field.type === "json") {
            return (
              <JsonField
                key={field.key}
                id={id}
                label={field.label}
                value={value}
                onChange={(next) => set(field.key, next)}
                placeholder={field.key === "body" ? '{ "key": "value" }' : "{}"}
                rows={4}
                help={field.templatable ? 'Supports {{dotted.path}} templating.' : undefined}
                className="sm:col-span-2"
              />
            )
          }

          if (field.options) {
            return (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={id}>{field.label}</Label>
                <Select
                  value={String(value ?? field.options[0].value)}
                  onValueChange={(v) => set(field.key, v)}
                >
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          }

          if (field.type === "number") {
            return (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={id}>{field.label}</Label>
                <Input
                  id={id}
                  type="number"
                  className="font-mono text-xs"
                  value={value === undefined || value === null ? "" : String(value)}
                  onChange={(e) =>
                    set(field.key, e.target.value === "" ? undefined : Number(e.target.value))
                  }
                />
              </div>
            )
          }

          const isLong = field.key === "text" || field.key === "body"

          return (
            <div key={field.key} className={cn("space-y-2", isLong && "sm:col-span-2")}>
              <Label htmlFor={id}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              {isLong ? (
                <Textarea
                  id={id}
                  rows={3}
                  placeholder={field.placeholder}
                  className="font-mono text-xs"
                  value={String(value ?? "")}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              ) : (
                <Input
                  id={id}
                  spellCheck={false}
                  placeholder={field.placeholder}
                  className="font-mono text-xs"
                  value={String(value ?? "")}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              )}
              {field.help && (
                <p className="text-xs text-muted-foreground">{field.help}</p>
              )}
            </div>
          )
        })}
      </div>

      {action === "http_request" && (
        <p className="text-xs text-muted-foreground">
          Use <code className="font-mono">mock://ok</code> to verify a run without leaving the
          network, or <code className="font-mono">mock://fail</code> to exercise retries.
        </p>
      )}
    </div>
  )
}

export { HTTP_METHODS }
