"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useMounted } from "@/hooks/use-mobile"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {/* Render both and swap with CSS to avoid a hydration mismatch. */}
      <Sun
        className={`size-4 ${mounted && !isDark ? "opacity-100" : "opacity-0"}`}
        aria-hidden
      />
      <Moon
        className={`absolute size-4 ${mounted && isDark ? "opacity-100" : "opacity-0"}`}
        aria-hidden
      />
    </Button>
  )
}
