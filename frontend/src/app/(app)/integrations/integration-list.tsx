"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Blocks,
  Check,
  Eye,
  Mail,
  Pencil,
  Plus,
  Trash2,
  Webhook as WebhookIcon,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { EmptyState, ErrorState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api/browser"
import { errorMessage } from "@/lib/api/error"
import { INTEGRATION_TYPES } from "@/lib/api/catalog"
import { formatDateShort } from "@/lib/format"
import type { Integration, IntegrationType } from "@/lib/api/types"

const TYPE_META: Record<IntegrationType, { label: string; icon: LucideIcon; className: string }> =
  {
    slack: {
      label: "Slack",
      icon: WebhookIcon,
      className: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    email: {
      label: "Email",
      icon: Mail,
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    http: {
      label: "HTTP",
      icon: Blocks,
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
  }

type FormState = {
  id?: string
  type: IntegrationType
  name: string
  fields: Record<string, string>
}

function emptyForm(type: IntegrationType = "slack"): FormState {
  return { type, name: "", fields: {} }
}

export function IntegrationList() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Integration | null>(null)

  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () => apiClient.integrations.list(),
  })

  const save = useMutation({
    mutationFn: async (value: FormState) => {
      const config: Record<string, unknown> = {}
      for (const [key, raw] of Object.entries(value.fields)) {
        if (raw.trim() === "") continue
        config[key] = /^\d+$/.test(raw.trim()) ? Number(raw) : raw.trim()
      }
      return value.id
        ? apiClient.integrations.update(value.id, { name: value.name, config })
        : apiClient.integrations.create({ type: value.type, name: value.name, config })
    },
    onSuccess: () => {
      toast.success("Integration saved")
      setForm(null)
      queryClient.invalidateQueries({ queryKey: ["integrations"] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.integrations.remove(id),
    onSuccess: () => {
      toast.success("Integration deleted")
      setPendingDelete(null)
      queryClient.invalidateQueries({ queryKey: ["integrations"] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const items = integrations.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm(emptyForm())}>
          <Plus className="size-4" aria-hidden />
          Add integration
        </Button>
      </div>

      {integrations.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : integrations.isError ? (
        <ErrorState
          message={errorMessage(integrations.error)}
          onRetry={integrations.refetch}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Blocks}
          title="No integrations yet"
          description="Store Slack webhook URLs, SMTP credentials and HTTP headers once so they are encrypted at rest."
          action={
            <Button onClick={() => setForm(emptyForm())}>
              <Plus className="size-4" aria-hidden />
              Add integration
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((integration) => {
            const meta = TYPE_META[integration.type]
            const Icon = meta.icon
            const entries = Object.entries(integration.config_preview ?? {})
            return (
              <Card key={integration.id} className="group relative">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.className}`}
                    >
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">{meta.label}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          className="pl-1.5"
                          onClick={() =>
                            setForm({
                              id: integration.id,
                              type: integration.type,
                              name: integration.name,
                              fields: {},
                            })
                          }
                        >
                          <Pencil className="size-4" aria-hidden />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          className="pl-1.5"
                          onClick={() => setPendingDelete(integration)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {entries.length > 0 ? (
                    <dl className="space-y-1 rounded-lg bg-muted/50 p-2.5">
                      {entries.map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <dt className="shrink-0 text-muted-foreground">{key}</dt>
                          <dd className="min-w-0 flex-1 truncate font-mono">
                            {String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-xs text-muted-foreground">No config stored</p>
                  )}

                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                      <Eye className="size-3" aria-hidden />
                      secrets redacted
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateShort(integration.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <IntegrationDialog
        form={form}
        onChange={setForm}
        pending={save.isPending}
        onClose={() => setForm(null)}
        onSave={() => form && save.mutate(form)}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The stored credentials are removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function IntegrationDialog({
  form,
  onChange,
  onClose,
  onSave,
  pending,
}: {
  form: FormState | null
  onChange: (form: FormState | null) => void
  onClose: () => void
  onSave: () => void
  pending: boolean
}) {
  const [showSecrets, setShowSecrets] = useState(false)
  const definition = form ? INTEGRATION_TYPES.find((t) => t.value === form.type) : undefined

  // The API only ever returns a redacted preview, so the dialog shows what is
  // currently stored instead of the real secret.
  const stored = useQuery({
    queryKey: ["integration", form?.id],
    queryFn: () => apiClient.integrations.get(form!.id!),
    enabled: Boolean(form?.id),
  })

  return (
    <Dialog open={form !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{form?.id ? "Edit integration" : "Add integration"}</DialogTitle>
          <DialogDescription>
            Credentials are encrypted with Fernet before they are stored and are never returned by
            the API.
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="space-y-4">
            {!form.id && (
              <div className="space-y-2">
                <Label htmlFor="int-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    v && onChange({ ...form, type: v as IntegrationType, fields: {} })
                  }
                >
                  <SelectTrigger id="int-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTEGRATION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="int-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="int-name"
                required
                maxLength={255}
                placeholder="Production Slack"
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
              />
            </div>

            {definition?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`int-${field.key}`}>
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </Label>
                <Input
                  id={`int-${field.key}`}
                  type={
                    /password|token|key|webhook_url/.test(field.key) && !showSecrets
                      ? "password"
                      : "text"
                  }
                  required={field.required}
                  placeholder={
                    form.id
                      ? "Leave blank to keep the stored value"
                      : field.placeholder
                  }
                  className="font-mono text-xs"
                  value={form.fields[field.key] ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...form,
                      fields: { ...form.fields, [field.key]: e.target.value },
                    })
                  }
                />
              </div>
            ))}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSecrets((v) => !v)}
              className="w-full text-muted-foreground"
            >
              {showSecrets ? (
                "Hide secret fields"
              ) : (
                <span className="flex items-center gap-1.5">
                  {showSecrets ? <Eye className="size-3.5" /> : <Check className="size-3.5" />}
                  Show secret fields
                </span>
              )}
            </Button>

            {form.id && (
              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/40 p-2.5">
                <p className="text-xs font-medium">Currently stored</p>
                {stored.isPending ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : stored.isError ? (
                  <p className="text-xs text-destructive">{errorMessage(stored.error)}</p>
                ) : Object.keys(stored.data?.config_preview ?? {}).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No config stored.</p>
                ) : (
                  <dl className="space-y-0.5">
                    {Object.entries(stored.data.config_preview).map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-[11px]">
                        <dt className="shrink-0 text-muted-foreground">{key}</dt>
                        <dd className="min-w-0 flex-1 truncate font-mono">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Config is shallow-merged on save, so blank fields keep their stored values.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={pending || !form?.name.trim() || !form?.type}
          >
            {pending ? "Saving…" : form?.id ? "Save changes" : "Create integration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
