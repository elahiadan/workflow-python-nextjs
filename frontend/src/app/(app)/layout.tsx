import { redirect } from "next/navigation"

import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireSession } from "@/lib/auth/session"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  if (!session) redirect("/login")

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh min-w-0">
        <AppHeader />
        <div className="flex min-w-0 flex-1 flex-col bg-grid">
          <div className="mx-auto w-full max-w-[1400px] min-w-0 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
