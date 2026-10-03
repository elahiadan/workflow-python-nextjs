import type {
  ExecutionStatus,
  StepExecutionStatus,
  WorkflowStatus,
} from "@/lib/api/types"

type Tone = {
  label: string
  className: string
  dot: string
}

const WORKFLOW_TONES: Record<WorkflowStatus, Tone> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/60",
  },
  active: {
    label: "Active",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    dot: "bg-emerald-500",
  },
  inactive: {
    label: "Inactive",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
    dot: "bg-amber-500",
  },
  archived: {
    label: "Archived",
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25",
    dot: "bg-slate-500",
  },
}

const EXECUTION_TONES: Record<ExecutionStatus, Tone> = {
  pending: {
    label: "Pending",
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25",
    dot: "bg-slate-400",
  },
  running: {
    label: "Running",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25",
    dot: "bg-blue-500 animate-pulse",
  },
  success: {
    label: "Success",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25",
    dot: "bg-red-500",
  },
}

const STEP_TONES: Record<StepExecutionStatus, Tone> = {
  ...EXECUTION_TONES,
  skipped: {
    label: "Skipped",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
    dot: "bg-amber-500",
  },
}

export const workflowTone = (status: WorkflowStatus): Tone =>
  WORKFLOW_TONES[status] ?? WORKFLOW_TONES.draft

export const executionTone = (status: ExecutionStatus): Tone =>
  EXECUTION_TONES[status] ?? EXECUTION_TONES.pending

export const stepTone = (status: StepExecutionStatus): Tone =>
  STEP_TONES[status] ?? STEP_TONES.pending

export const isTerminal = (status: ExecutionStatus) =>
  status === "success" || status === "failed"
