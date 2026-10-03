"use client"

import { CalendarClock, Webhook } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import type { TriggerType } from "@/lib/api/types"

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily at 09:00", value: "0 9 * * *" },
  { label: "Weekdays at 09:00", value: "0 9 * * 1-5" },
  { label: "Monthly", value: "0 9 1 * *" },
]

export function TriggerEditor({
  type,
  config,
  onChange,
}: {
  type: TriggerType
  config: Record<string, unknown>
  onChange: (patch: { type?: TriggerType; config: Record<string, unknown> }) => void
}) {
  return (
    <div className="space-y-4">
      <RadioGroup
        value={type}
        onValueChange={(value) => {
          const next = value as TriggerType
          onChange({
            type: next,
            config:
              next === "schedule"
                ? { schedule: "0 * * * *", timezone: "UTC" }
                : {},
          })
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <TriggerOption
          value="webhook"
          icon={Webhook}
          title="Webhook"
          description="Run when an external system POSTs to a unique URL."
        />
        <TriggerOption
          value="schedule"
          icon={CalendarClock}
          title="Schedule"
          description="Run automatically on a cron expression."
        />
      </RadioGroup>

      {type === "schedule" && (
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
          <div className="space-y-2">
            <Label htmlFor="trigger-cron">Cron expression</Label>
            <Input
              id="trigger-cron"
              spellCheck={false}
              className="font-mono text-xs"
              placeholder="0 9 * * 1-5"
              value={String(config.schedule ?? config.cron ?? "")}
              onChange={(e) => onChange({ config: { ...config, schedule: e.target.value } })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trigger-tz">Timezone</Label>
            <Input
              id="trigger-tz"
              placeholder="UTC"
              className="font-mono text-xs"
              value={String(config.timezone ?? "UTC")}
              onChange={(e) => onChange({ config: { ...config, timezone: e.target.value } })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Presets</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CRON_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onChange({ config: { ...config, schedule: preset.value } })}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            The scheduler checks every 60 seconds, so a run can start up to a minute after its
            scheduled time.
          </p>
        </div>
      )}
    </div>
  )
}

function TriggerOption({
  value,
  icon: Icon,
  title,
  description,
}: {
  value: TriggerType
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  const id = `trigger-${value}`
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border border-border/70 p-3 transition-colors",
        "hover:border-primary/40 hover:bg-accent/40",
        "has-[[data-checked]]:border-primary/60 has-[[data-checked]]:bg-primary/5",
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  )
}
