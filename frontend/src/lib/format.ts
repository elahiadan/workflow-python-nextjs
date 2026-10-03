import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns"

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = typeof value === "string" ? parseISO(value) : value
  return isValid(date) ? date : null
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, "MMM d, yyyy · HH:mm:ss") : "—"
}

export function formatDateShort(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, "MMM d, yyyy") : "—"
}

export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, "HH:mm:ss.SSS") : "—"
}

export function relativeTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return "—"
  return `${formatDistanceToNowStrict(date)} ago`
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat().format(value)
}

export function initials(name: string, email?: string): string {
  const source = name?.trim() || email?.split("@")[0] || "?"
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "—"
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function truncate(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}
