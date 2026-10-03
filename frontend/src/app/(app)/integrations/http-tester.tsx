"use client"

import { useMutation } from "@tanstack/react-query"
import { Play, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { JsonViewer } from "@/components/json-viewer"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { HTTP_METHODS } from "@/lib/api/catalog"
import { apiClient } from "@/lib/api/browser"
import { errorMessage } from "@/lib/api/error"
import { stepTone } from "@/lib/status"
import type { HttpActionRequest, HttpActionResult } from "@/lib/api/types"

type Header = { id: number; key: string; value: string }

const nextId = () => Math.floor(Date.now() % 100000)

export function HttpTester() {
  const [method, setMethod] = useState<HttpActionRequest["method"]>("GET")
  const [url, setUrl] = useState("https://api.github.com/repos/vercel/next.js")
  const [headers, setHeaders] = useState<Header[]>([
    { id: 1, key: "Accept", value: "application/json" },
  ])
  const [body, setBody] = useState("")

  const test = useMutation({
    mutationFn: () => {
      const parsed: Record<string, unknown> = {}
      const trimmed = body.trim()
      if (trimmed) {
        const value: unknown = JSON.parse(trimmed)
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new Error("Body must be a JSON object")
        }
        parsed.body = value
      }

      return apiClient.actions.testHttp({
        method,
        url,
        headers: Object.fromEntries(
          headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value]),
        ),
        ...parsed,
      } as HttpActionRequest)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="w-28 shrink-0">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpActionRequest["method"])}
                aria-label="HTTP method"
                className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:border-ring outline-none"
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/endpoint"
              className="font-mono text-xs"
              aria-label="Request URL"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Headers</Label>
              <Button
                variant="ghost"
                size="xs"
                onClick={() =>
                  setHeaders((h) => [...h, { id: nextId(), key: "", value: "" }])
                }
              >
                <Plus className="size-3" aria-hidden />
                Add header
              </Button>
            </div>
            {headers.map((header, i) => (
              <div key={header.id} className="flex gap-2">
                <Input
                  value={header.key}
                  placeholder="Header"
                  aria-label={`Header ${i + 1} name`}
                  className="font-mono text-xs"
                  onChange={(e) =>
                    setHeaders((h) =>
                      h.map((x) => (x.id === header.id ? { ...x, key: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  value={header.value}
                  placeholder="Value"
                  aria-label={`Header ${i + 1} value`}
                  className="font-mono text-xs"
                  onChange={(e) =>
                    setHeaders((h) =>
                      h.map((x) => (x.id === header.id ? { ...x, value: e.target.value } : x)),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove header ${i + 1}`}
                  onClick={() => setHeaders((h) => h.filter((x) => x.id !== header.id))}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tester-body">Body (JSON object)</Label>
            <Textarea
              id="tester-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'{\n  "name": "{{ trigger.order.id }}"\n}'}
              className="min-h-28 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Template placeholders like <code className="font-mono">{"{{ trigger.x }}"}</code> are
              left untouched so you can copy the body straight into a step.
            </p>
          </div>

          <Button
            onClick={() => test.mutate()}
            disabled={test.isPending || !url.trim()}
          >
            <Play className="size-3.5" aria-hidden />
            {test.isPending ? "Sending…" : "Send request"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Response</CardTitle>
        </CardHeader>
        <CardContent>
          {test.data ? (
            <HttpResult result={test.data} />
          ) : test.isPending ? (
            <p className="text-sm text-muted-foreground">Waiting for response…</p>
          ) : test.isError ? (
            <p className="text-sm text-destructive">{errorMessage(test.error)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Send a request to see the status, timing and parsed response body.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function HttpResult({ result }: { result: HttpActionResult }) {
  const { data } = result
  const tone = stepTone(data.status_code >= 400 ? "failed" : "success")
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={tone} />
        <span className="font-mono text-sm font-semibold tabular-nums">
          {data.status_code}
        </span>
        {data.mock && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            mock
          </Badge>
        )}
      </div>

      {data.mock ? (
        <p className="text-sm text-muted-foreground">
          <code className="font-mono text-xs">{data.method}</code>{" "}
          <code className="font-mono text-xs">{data.url}</code> was handled by the{" "}
          <code className="font-mono text-xs">mock://</code> test double, so no network request was
          made.
        </p>
      ) : (
        <div className="rounded-lg border border-border/70 p-2">
          <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Body
          </p>
          <JsonViewer data={data.response} emptyMessage="Empty body" />
        </div>
      )}
    </div>
  )
}
