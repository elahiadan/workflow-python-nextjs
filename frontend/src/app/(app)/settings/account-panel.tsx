"use client"

import { LogOut, Mail, ShieldCheck, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { workflowAuth } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { initials } from "@/lib/format"
import type { User } from "@/lib/api/types"

export function AccountPanel({
  user,
  agreesWithAltPath,
}: {
  user: User | null
  agreesWithAltPath?: boolean
}) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4" aria-hidden />
          Account
        </CardTitle>
        <CardDescription>
          Your identity comes from the API. Email and password are managed on the backend, so this
          panel is read-only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {user ? (
          <div className="flex flex-wrap items-center gap-4">
            <div
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
            >
              {initials(user.full_name || user.email)}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium">{user.full_name || "Unnamed user"}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail className="size-3" aria-hidden />
                {user.email}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                user.is_active
                  ? "gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "gap-1 text-muted-foreground"
              }
            >
              <ShieldCheck className="size-3" aria-hidden />
              {user.is_active ? "Active" : "Disabled"}
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Could not load your profile. Your session may have expired —{" "}
            <Link href="/login" className="text-primary hover:underline">
              sign in again
            </Link>
            .
          </p>
        )}

        <dl className="mt-5 grid gap-3 border-t border-border/70 pt-4 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="font-mono break-all">{user?.id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Member since</dt>
            <dd>{user ? formatDate(user.created_at) : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Profile read via</dt>
            <dd className="font-mono text-muted-foreground">
              /auth/me{agreesWithAltPath === undefined ? "" : agreesWithAltPath ? " + /users/me (in agreement)" : " + /users/me (MISMATCH)"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-border/70 pt-4">
          <Button
            variant="outline"
            onClick={async () => {
              await workflowAuth.signOut()
              router.push("/login")
              router.refresh()
            }}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
