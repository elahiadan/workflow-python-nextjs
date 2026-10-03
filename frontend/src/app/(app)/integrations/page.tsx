import type { Metadata } from "next"

import { IntegrationList } from "./integration-list"
import { HttpTester } from "./http-tester"

export const metadata: Metadata = { title: "Integrations" }

export default function IntegrationsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Reusable credentials, stored encrypted. Reference them from any action step.
        </p>
      </div>

      <IntegrationList />

      <div className="space-y-4 border-t border-border/70 pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Test an HTTP action</h2>
          <p className="text-sm text-muted-foreground">
            Sends a real request through the API with the same execution context used in workflows,
            so you can validate a URL, headers and body before wiring up a step.
          </p>
        </div>
        <HttpTester />
      </div>
    </div>
  )
}
