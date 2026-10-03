import type { StepIn, TriggerIn, TriggerType, Workflow } from "@/lib/api/types"

/**
 * Client-side editing model for the builder. Converted to the exact
 * `WorkflowCreate`/`WorkflowUpdate` shape the API expects on save.
 */
export type DraftStep = {
  /** Local id; the API assigns its own and recreates steps on every save. */
  key: string
  name: string
  type: "condition" | "action"
  action: string | null
  config: Record<string, unknown>
  max_attempts: number
  retry_delay_seconds: number
  timeout_seconds: number
  collapsed: boolean
}

export type Draft = {
  name: string
  description: string
  triggerType: TriggerType
  triggerConfig: Record<string, unknown>
  steps: DraftStep[]
}

let counter = 0
export function nextKey(prefix = "step"): string {
  counter += 1
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 8)}`
}

export function newStep(type: DraftStep["type"]): DraftStep {
  if (type === "condition") {
    return {
      key: nextKey(),
      name: "Condition",
      type: "condition",
      action: null,
      config: { field: "", operator: "==", value: "" },
      max_attempts: 3,
      retry_delay_seconds: 30,
      timeout_seconds: 30,
      collapsed: false,
    }
  }
  return {
    key: nextKey(),
    name: "",
    type: "action",
    action: "http_request",
    config: { method: "POST", url: "" },
    max_attempts: 3,
    retry_delay_seconds: 30,
    timeout_seconds: 30,
    collapsed: false,
  }
}

export function draftFromWorkflow(workflow: Workflow): Draft {
  const trigger = workflow.triggers[0]
  return {
    name: workflow.name,
    description: workflow.description,
    triggerType: (trigger?.type as TriggerType) ?? "webhook",
    triggerConfig: { ...(trigger?.config ?? {}) },
    steps: [...workflow.steps]
      .sort((a, b) => a.order_index - b.order_index)
      .map((step) => ({
        key: nextKey(),
        name: step.name,
        type: step.type === "condition" ? "condition" : "action",
        action: step.action,
        config: { ...step.config },
        max_attempts: step.max_attempts,
        retry_delay_seconds: step.retry_delay_seconds,
        timeout_seconds: step.timeout_seconds,
        collapsed: true,
      })),
  }
}

export function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    triggerType: "webhook",
    triggerConfig: {},
    steps: [newStep("action")],
  }
}

export function toStepIn(step: DraftStep, order: number): StepIn {
  return {
    name: step.name || defaultStepName(step),
    type: step.type,
    action: step.type === "action" ? (step.action ?? undefined) : null,
    config: step.config,
    order,
    max_attempts: step.max_attempts,
    retry_delay_seconds: step.retry_delay_seconds,
    timeout_seconds: step.timeout_seconds,
  }
}

function defaultStepName(step: DraftStep): string {
  if (step.type === "condition") {
    const field = String(step.config.field ?? "")
    const operator = String(step.config.operator ?? "==")
    return field ? `If ${field} ${operator}` : "Condition"
  }
  return step.action ?? "Action"
}

export function toPayload(draft: Draft): { trigger: TriggerIn; steps: StepIn[] } {
  return {
    trigger: { type: draft.triggerType, config: draft.triggerConfig },
    steps: draft.steps.map(toStepIn),
  }
}

/**
 * Merges a partial step patch. Editors send sparse patches, so a key that is
 * present but `undefined` (e.g. `action: undefined` from an editor that only
 * meant to change the config) must not overwrite a real value.
 */
export function applyStepPatch(step: DraftStep, patch: Partial<DraftStep>): DraftStep {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<DraftStep>
  return { ...step, ...defined }
}

/** Mirrors the server-side write-time validation so the user sees it inline. */
export function validateDraft(draft: Draft): string[] {
  const errors: string[] = []

  if (!draft.name.trim()) errors.push("Workflow name is required.")
  if (draft.name.length > 255) errors.push("Workflow name must be 255 characters or fewer.")

  if (draft.triggerType === "schedule") {
    const schedule = String(draft.triggerConfig.schedule ?? draft.triggerConfig.cron ?? "").trim()
    if (!schedule) errors.push("A cron expression is required for scheduled workflows.")
  }

  if (draft.steps.length === 0) errors.push("Add at least one step.")

  draft.steps.forEach((step, index) => {
    const label = `Step ${index + 1}`
    if (step.type === "condition") {
      if (!String(step.config.field ?? "").trim()) {
        errors.push(`${label}: condition needs a field.`)
      }
      if (!String(step.config.operator ?? "").trim()) {
        errors.push(`${label}: condition needs an operator.`)
      }
    } else if (!step.action) {
      errors.push(`${label}: choose an action.`)
    }
    if (step.max_attempts < 1 || step.max_attempts > 10) {
      errors.push(`${label}: max attempts must be between 1 and 10.`)
    }
    if (step.retry_delay_seconds < 0 || step.retry_delay_seconds > 3600) {
      errors.push(`${label}: retry delay must be between 0 and 3600 seconds.`)
    }
    if (step.timeout_seconds < 1 || step.timeout_seconds > 300) {
      errors.push(`${label}: timeout must be between 1 and 300 seconds.`)
    }
  })

  return errors
}
