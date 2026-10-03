"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Plus, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { StepCard } from "./step-card"
import { TriggerEditor } from "./trigger-editor"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { apiClient } from "@/lib/api/browser"
import { errorMessage } from "@/lib/api/error"
import {
  applyStepPatch,
  newStep,
  toPayload,
  validateDraft,
  type Draft,
  type DraftStep,
} from "@/lib/builder/draft"

export function WorkflowBuilder({
  initial,
  workflowId,
}: {
  initial: Draft
  workflowId?: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(initial)
  const [showErrors, setShowErrors] = useState(false)

  const errors = useMemo(() => validateDraft(draft), [draft])
  const isEditing = Boolean(workflowId)

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = toPayload(value)
      const body = {
        name: value.name.trim(),
        description: value.description,
        ...payload,
      }
      return isEditing
        ? apiClient.workflows.update(workflowId!, body)
        : apiClient.workflows.create(body)
    },
    onSuccess: (workflow) => {
      toast.success(
        isEditing ? `Saved version ${workflow.version}` : "Workflow created as draft",
      )
      queryClient.invalidateQueries({ queryKey: ["workflows"] })
      if (isEditing) {
        queryClient.invalidateQueries({ queryKey: ["workflow", workflow.id] })
        router.refresh()
      } else {
        router.push(`/workflows/${workflow.id}`)
        router.refresh()
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  function updateStep(key: string, patch: Partial<DraftStep>) {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s) => (s.key === key ? applyStepPatch(s, patch) : s)),
    }))
  }

  function removeStep(key: string) {
    setDraft((d) => ({ ...d, steps: d.steps.filter((s) => s.key !== key) }))
  }

  function duplicateStep(key: string) {
    setDraft((d) => {
      const index = d.steps.findIndex((s) => s.key === key)
      if (index === -1) return d
      const source = d.steps[index]
      const copy: DraftStep = {
        ...source,
        key: `${source.key}-copy-${Math.random().toString(36).slice(2, 7)}`,
        config: structuredClone(source.config),
      }
      const steps = [...d.steps]
      steps.splice(index + 1, 0, copy)
      return { ...d, steps }
    })
  }

  function moveStep(key: string, direction: -1 | 1) {
    setDraft((d) => {
      const index = d.steps.findIndex((s) => s.key === key)
      const target = index + direction
      if (index === -1 || target < 0 || target >= d.steps.length) return d
      const steps = [...d.steps]
      ;[steps[index], steps[target]] = [steps[target], steps[index]]
      return { ...d, steps }
    })
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (errors.length > 0) {
      setShowErrors(true)
      toast.error("Fix the highlighted problems before saving")
      return
    }
    save.mutate(draft)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Name and describe what this automation does.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wf-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wf-name"
              required
              maxLength={255}
              placeholder="Fulfil high-value orders"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wf-description">Description</Label>
            <Textarea
              id="wf-description"
              rows={2}
              placeholder="When a large order arrives, notify Slack and send a confirmation email."
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trigger</CardTitle>
          <CardDescription>What starts this workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <TriggerEditor
            type={draft.triggerType}
            config={draft.triggerConfig}
            onChange={({ type, config }) =>
              setDraft((d) => ({
                ...d,
                triggerType: type ?? d.triggerType,
                triggerConfig: config,
              }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Steps</CardTitle>
          <CardDescription>
            Steps run top to bottom. A failed condition stops the run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft.steps.length === 0 ? (
            <EmptyState
              title="No steps yet"
              description="Add an action to do some work, or a condition to branch the run."
              className="py-10"
            />
          ) : (
            draft.steps.map((step, index) => (
              <StepCard
                key={step.key}
                step={step}
                index={index}
                total={draft.steps.length}
                isFirst={index === 0}
                isLast={index === draft.steps.length - 1}
                onChange={(patch) => updateStep(step.key, patch)}
                onRemove={() => removeStep(step.key)}
                onDuplicate={() => duplicateStep(step.key)}
                onMove={(direction) => moveStep(step.key, direction)}
              />
            ))
          )}

          <Separator className="my-4" />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft((d) => ({ ...d, steps: [...d.steps, newStep("action")] }))}
            >
              <Plus className="size-4" aria-hidden />
              Add action
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDraft((d) => ({ ...d, steps: [...d.steps, newStep("condition")] }))
              }
            >
              <Plus className="size-4" aria-hidden />
              Add condition
            </Button>
          </div>
        </CardContent>
      </Card>

      {showErrors && errors.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
            Fix {errors.length} {errors.length === 1 ? "problem" : "problems"} before saving
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pb-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={save.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          <Save className="size-4" aria-hidden />
          {save.isPending
            ? "Saving…"
            : isEditing
              ? "Save changes"
              : "Create workflow"}
        </Button>
      </div>
    </form>
  )
}
