"use client"

import {
  Blocks,
  Cable,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Workflow as WorkflowIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSession, workflowAuth } from "@/lib/auth/client"
import { initials } from "@/lib/format"

export function AppHeader() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { data: session, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const user = session?.user
  const name = user?.name || user?.email || "Account"

  async function handleSignOut() {
    setSigningOut(true)
    try {
      const { error } = await workflowAuth.signOut()
      if (error) throw error
      toast.success("Signed out")
      router.replace("/login")
      router.refresh()
    } catch {
      toast.error("Could not sign out")
    } finally {
      setSigningOut(false)
    }
  }

  function go(href: string) {
    setPaletteOpen(false)
    router.push(href)
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-md sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 !h-5" />

      <Button
        variant="outline"
        onClick={() => setPaletteOpen(true)}
        className="hidden w-64 justify-start gap-2 text-muted-foreground sm:flex"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="text-sm">Search…</span>
        <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={() => setPaletteOpen(true)}
        aria-label="Search"
      >
        <Search className="size-4" aria-hidden />
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button
          size="sm"
          className="hidden sm:inline-flex"
          nativeButton={false}
          render={<Link href="/workflows/new" />}
        >
          <Plus className="size-4" aria-hidden />
          New workflow
        </Button>
        <Button
          size="icon"
          className="sm:hidden"
          nativeButton={false}
          aria-label="New workflow"
          render={<Link href="/workflows/new" />}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 rounded-full"
                aria-label="Account menu"
              />
            }
          >
              {isPending ? (
                <Skeleton className="size-6 rounded-full" />
              ) : (
                <Avatar className="size-7">
                  <AvatarFallback className="text-[10px]">
                    {initials(name, user?.email)}
                  </AvatarFallback>
                </Avatar>
              )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{name}</p>
              {user?.email && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />} className="pl-1.5">
              <Settings className="size-4" aria-hidden />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={signingOut}
              onSelect={(e) => {
                e.preventDefault()
                handleSignOut()
              }}
            >
              <LogOut className="size-4" aria-hidden />
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNavigate={go} />
    </header>
  )
}

function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (href: string) => void
}) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump to a page or run an action"
    >
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => onNavigate("/dashboard")}>
            <LayoutDashboard className="size-4" aria-hidden />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => onNavigate("/workflows")}>
            <WorkflowIcon className="size-4" aria-hidden />
            Workflows
          </CommandItem>
          <CommandItem onSelect={() => onNavigate("/executions")}>
            <Cable className="size-4" aria-hidden />
            Executions
          </CommandItem>
          <CommandItem onSelect={() => onNavigate("/integrations")}>
            <Blocks className="size-4" aria-hidden />
            Integrations
          </CommandItem>
          <CommandItem onSelect={() => onNavigate("/settings")}>
            <Settings className="size-4" aria-hidden />
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => onNavigate("/workflows/new")}>
            <Plus className="size-4" aria-hidden />
            Create workflow
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => onNavigate("/settings#http-tester")}>
            <Search className="size-4" aria-hidden />
            Test an HTTP action
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Appearance">
          <CommandItem
            onSelect={() => {
              onOpenChange(false)
              document.documentElement.classList.toggle("dark")
            }}
          >
            <Sun className="size-4 dark:hidden" aria-hidden />
            <Moon className="hidden size-4 dark:block" aria-hidden />
            Toggle dark mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
