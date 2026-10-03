"use client"

import { LogOut, User as UserIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession, workflowAuth } from "@/lib/auth/client"
import { initials } from "@/lib/format"

export function UserMenu() {
  const { data: session, isPending } = useSession()
  const { setOpen } = useSidebar()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarMenuButton size="lg" tooltip={isPending ? "Loading…" : name} />}
      >
          {isPending ? (
            <Skeleton className="size-8 shrink-0 rounded-full" />
          ) : (
            <Avatar className="size-8 shrink-0 rounded-lg">
              <AvatarFallback className="rounded-lg text-xs">
                {initials(name, user?.email)}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="grid flex-1 items-center gap-0.5 text-left">
            <span className="truncate text-sm font-medium">{name}</span>
            {user?.email && (
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            )}
          </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{name}</p>
          {user?.email && (
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<a href="/settings" />}
          className="pl-1.5"
        >
          <UserIcon className="size-4" aria-hidden />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => {
            e.preventDefault()
            setOpen(true)
            handleSignOut()
          }}
          disabled={signingOut}
        >
          <LogOut className="size-4" aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
