"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, RefreshCw, Send, Webhook } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { CopyButton } from "@/components/copy-button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api/browser"
import { errorMessage } from "@/lib/api/error"
import type { WebhookListItem, Workflow } from "@/lib/api/types"

const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/\/$/, "") ?? "http://localhost:8000"

const SAMPLE_PAYLOAD = `{
  "order": {
    "id": "ord_12345",
    "total": 249.99,
    "currency": "USD",
    "customer": {
      "email": "buyer@example.com",
      "name": "Ada Lovelace"
    }
  }
}`

export function WebhookPanel({ workflow }: { workflow: Workflow }) {
  const queryClient = useQueryClient()
  const [payload, setPayload] = useState(SAMPLE_PAYLOAD)
  const [eventId, setEventId] = useState("")
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const webhooks = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => apiClient.webhooks.list(),
  })

  const hook: WebhookListItem | undefined = (webhooks.data ?? []).find(
    (w) => w.workflow_id === workflow.id,
  )
  const inlineHook = workflow.webhooks[0]
  const token = hook?.token ?? inlineHook?.token

  const url = useMemo(
    () =>
      token
        ? `${API_ORIGIN}/api/v1/webhooks/${token}`
        : null,
    [token],
  )

  const rotate = useMutation({
    mutationFn: (id: string) => apiClient.webhooks.rotate(id),
    onSuccess: () => {
      toast.success("Webhook token rotated — the old URL no longer works")
      queryClient.invalidateQueries({ queryKey: ["webhooks"] })
      queryClient.invalidateQueries({ queryKey: ["workflow", workflow.id] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  async function send() {
    if (!token) return
    let body: unknown
    try {
      body = JSON.parse(payload)
    } catch {
      toast.error("Payload is not valid JSON")
      return
    }

    setSending(true)
    setLastResult(null)
    try {
      const params = new URLSearchParams({ token })
      if (eventId) params.set("eventId", eventId)
      const res = await fetch(`/api/webhook-test?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`)
      setLastResult(
        `HTTP ${res.status} · execution ${String(data.execution_id).slice(0, 8)}… · ${data.mode ?? data.status}`,
      )
      toast.success("Test event accepted")
      queryClient.invalidateQueries({ queryKey: ["executions"] })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
          <CardDescription>This workflow is not webhook-triggered.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="size-4 text-muted-foreground" aria-hidden />
          Webhook endpoint
        </CardTitle>
        <CardDescription>
          POST JSON to this URL to start a run. Replaying the same{" "}
          <code className="font-mono text-xs">X-Event-Id</code> is deduplicated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Endpoint URL</Label>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={url ?? ""}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <CopyButton value={url ?? ""} />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Rotate webhook token"
              onClick={() => hook && rotate.mutate(hook.id)}
              disabled={!hook || rotate.isPending}
            >
              <RefreshCw
                className={rotate.isPending ? "size-4 animate-spin" : "size-4"}
                aria-hidden
              />
            </Button>
          </div>
          {hook && (
            <p className="text-xs text-muted-foreground">
              Rotating invalidates the current URL immediately.
            </p>
          )}
        </div>

        <Separator />

        <Tabs defaultValue="test">
          <TabsList>
            <TabsTrigger value="test">Send test event</TabsTrigger>
            <TabsTrigger value="curl">cURL</TabsTrigger>
          </TabsList>

          <TabsContent value="test" className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="test-payload">Payload (JSON)</Label>
              <Textarea
                id="test-payload"
                rows={9}
                spellCheck={false}
                className="font-mono text-xs"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-event-id">X-Event-Id (optional)</Label>
              <Input
                id="test-event-id"
                placeholder="evt_0001"
                className="font-mono text-xs"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" onClick={send} disabled={sending}>
                <Send className="size-4" aria-hidden />
                {sending ? "Sending…" : "Send test event"}
              </Button>
              {lastResult && (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {lastResult}
                </Badge>
              )}
            </div>
            {workflow.status !== "active" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This workflow is {workflow.status}. The API rejects events unless it is active.
              </p>
            )}
          </TabsContent>

          <TabsContent value="curl" className="mt-3">
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-muted/70 p-3 font-mono text-[11px] leading-relaxed">
{`curl -X POST '${url}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Event-Id: evt_0001' \\
  -d '${payload.replace(/\n\s*/g, "")}'`}
              </pre>
              <CopyButton
                value={`curl -X POST '${url}' -H 'Content-Type: application/json' -H 'X-Event-Id: evt_0001' -d '${payload.replace(/\n\s*/g, "")}'`}
                size="sm"
                variant="secondary"
                className="absolute right-2 top-2"
              />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Copy className="size-3" aria-hidden />
              Responses use HTTP 202 and return an execution id to poll.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
