"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CopyButton({
  value,
  label = "Copy",
  className,
  size = "icon",
  variant = "ghost",
}: {
  value: string
  label?: string
  className?: string
  size?: "icon" | "sm" | "default"
  variant?: "ghost" | "outline" | "secondary"
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  const Icon = copied ? Check : Copy

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn(size === "sm" && "h-7 gap-1.5 text-xs", className)}
    >
      <Icon className="size-3.5" aria-hidden />
      {size !== "icon" && (copied ? "Copied" : label)}
    </Button>
  )
}
