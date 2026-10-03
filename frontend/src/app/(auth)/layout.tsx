import Link from "next/link"
import { redirect } from "next/navigation"

import { Logo } from "@/components/logo"
import { getSession } from "@/lib/auth/session"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (session) redirect("/dashboard")

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-grid opacity-60"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/5 to-transparent"
        aria-hidden
      />

      <div className="relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2.5"
          aria-label="Workflow home"
        >
          <Logo className="size-9" />
          <span className="text-lg font-semibold tracking-tight">Workflow</span>
        </Link>
        {children}
      </div>
    </div>
  )
}
