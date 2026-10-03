import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function StatusBadge({
  tone,
  className,
  showDot = true,
}: {
  tone: { label: string; className: string; dot: string }
  className?: string
  showDot?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium capitalize", tone.className, className)}
    >
      {showDot && (
        <span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden />
      )}
      {tone.label}
    </Badge>
  )
}
