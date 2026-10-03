import type { ConditionOperator, HttpMethod, IntegrationType } from "./types"

/**
 * `GET /api/v1/actions` only returns action *names*, so the config schema for
 * each action is hardcoded here (mirrors app/integrations/actions.py).
 */
export type ActionFieldType = "string" | "number" | "boolean" | "json"

export type ActionField = {
  key: string
  label: string
  type: ActionFieldType
  required?: boolean
  placeholder?: string
  help?: string
  /** Templatable with {{dotted.path}} resolved against the trigger payload. */
  templatable?: boolean
  options?: { value: string; label: string }[]
}

export type ActionDefinition = {
  name: string
  label: string
  description: string
  /** lucide-react icon name, resolved in components/steps/action-icon.tsx */
  icon: string
  fields: ActionField[]
}

export const ACTIONS: Record<string, ActionDefinition> = {
  http_request: {
    name: "http_request",
    label: "HTTP Request",
    description: "Call any external HTTP API with a templated URL, body and headers.",
    icon: "Globe",
    fields: [
      {
        key: "method",
        label: "Method",
        type: "string",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({
          value: m,
          label: m,
        })),
      },
      {
        key: "url",
        label: "URL",
        type: "string",
        required: true,
        templatable: true,
        placeholder: "https://api.example.com/v1/orders",
        help: "mock://ok works offline. Private and loopback hosts are blocked by the SSRF guard.",
      },
      { key: "headers", label: "Headers", type: "json", templatable: true },
      { key: "params", label: "Query params", type: "json", templatable: true },
      { key: "body", label: "Body", type: "json", templatable: true },
      { key: "timeout", label: "Timeout (s)", type: "number" },
    ],
  },
  send_email: {
    name: "send_email",
    label: "Send Email",
    description: "Send a transactional email. Mocked when the provider is set to mock.",
    icon: "Mail",
    fields: [
      {
        key: "to",
        label: "To",
        type: "string",
        required: true,
        templatable: true,
        placeholder: "ops@example.com",
        help: "Addresses ending in @example.com are always mocked.",
      },
      { key: "subject", label: "Subject", type: "string", templatable: true },
      { key: "body", label: "Body", type: "string", templatable: true },
    ],
  },
  send_slack_message: {
    name: "send_slack_message",
    label: "Send Slack Message",
    description: "Post a message to Slack through an incoming webhook URL.",
    icon: "MessageSquare",
    fields: [
      {
        key: "webhook_url",
        label: "Webhook URL",
        type: "string",
        required: true,
        templatable: true,
        placeholder: "https://hooks.slack.com/services/...",
      },
      { key: "text", label: "Message", type: "string", required: true, templatable: true },
      { key: "channel", label: "Channel", type: "string", templatable: true },
      { key: "timeout", label: "Timeout (s)", type: "number" },
    ],
  },
  delay: {
    name: "delay",
    label: "Delay",
    description: "Pause the run for a fixed number of seconds. Clamped to 0–3600.",
    icon: "Timer",
    fields: [
      { key: "seconds", label: "Seconds", type: "number", required: true, templatable: true },
    ],
  },
}

export const ACTION_NAMES = Object.keys(ACTIONS)

export type OperatorDefinition = {
  value: ConditionOperator
  label: string
  description: string
  /** Operators that ignore the comparison value entirely. */
  unary?: boolean
  /** Operators where the right-hand side should be a list. */
  expectsList?: boolean
  /** Operators where the right-hand side is not free text. */
  expectsNumber?: boolean
}

export const OPERATORS: OperatorDefinition[] = [
  { value: "==", label: "equals", description: "Strict equality" },
  { value: "!=", label: "not equals", description: "Strict inequality" },
  { value: ">", label: "greater than", description: "Numeric compare, coerces strings", expectsNumber: true },
  { value: ">=", label: "greater or equal", description: "Numeric compare, coerces strings", expectsNumber: true },
  { value: "<", label: "less than", description: "Numeric compare, coerces strings", expectsNumber: true },
  { value: "<=", label: "less or equal", description: "Numeric compare, coerces strings", expectsNumber: true },
  { value: "contains", label: "contains", description: "List membership or substring" },
  { value: "not_contains", label: "does not contain", description: "List non-membership or substring" },
  { value: "starts_with", label: "starts with", description: "String prefix" },
  { value: "ends_with", label: "ends with", description: "String suffix" },
  { value: "in", label: "is one of", description: "Value is in the given list", expectsList: true },
  { value: "not_in", label: "is not one of", description: "Value is not in the given list", expectsList: true },
  { value: "is_empty", label: "is empty", description: "null, \"\", [] or {}", unary: true },
  { value: "is_not_empty", label: "is not empty", description: "Anything other than empty", unary: true },
]

export const OPERATOR_VALUES = OPERATORS.map((o) => o.value)

export function getOperator(value: string): OperatorDefinition {
  return OPERATORS.find((o) => o.value === value) ?? OPERATORS[0]
}

export const INTEGRATION_TYPES: {
  value: IntegrationType
  label: string
  description: string
  fields: ActionField[]
}[] = [
  {
    value: "slack",
    label: "Slack",
    description: "Incoming webhook plus a default channel.",
    fields: [
      { key: "webhook_url", label: "Webhook URL", type: "string", required: true, placeholder: "https://hooks.slack.com/services/..." },
      { key: "channel", label: "Channel", type: "string", placeholder: "#ops" },
    ],
  },
  {
    value: "email",
    label: "Email",
    description: "SMTP credentials or a sandbox recipient.",
    fields: [
      { key: "to", label: "Default recipient", type: "string", required: true, placeholder: "alerts@example.com" },
      { key: "from", label: "From address", type: "string", placeholder: "noreply@example.com" },
      { key: "smtp_password", label: "SMTP password", type: "string" },
    ],
  },
  {
    value: "http",
    label: "HTTP",
    description: "Base URL, headers and a default timeout.",
    fields: [
      { key: "base_url", label: "Base URL", type: "string", required: true, placeholder: "https://api.example.com" },
      { key: "api_key", label: "API key", type: "string" },
      { key: "timeout", label: "Timeout (s)", type: "number" },
    ],
  },
]

export const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"]

export const WORKFLOW_STATUSES = ["draft", "active", "inactive", "archived"] as const

export const EXECUTION_STATUSES = ["pending", "running", "success", "failed"] as const
