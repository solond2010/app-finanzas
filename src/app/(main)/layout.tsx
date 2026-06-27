"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { QuickActionsFAB } from "@/components/layout/quick-actions"
import { FinanceProvider } from "@/lib/store"
import { ToastProvider } from "@/components/ui/toast"
import { PrivacyProvider } from "@/lib/privacy"
import { SidebarProvider, useSidebar } from "@/lib/sidebar"
import { cn } from "@/lib/utils"

function MainInner({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={cn(
        "min-h-screen flex-1 pt-[var(--mobile-header-h)] lg:pt-8 p-3 sm:p-6 lg:p-8 animate-in fade-in duration-500 transition-all",
        open ? "lg:ml-64" : "lg:ml-0"
      )}>
        {children}
      </main>
    </div>
  )
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <ToastProvider>
        <PrivacyProvider>
          <SidebarProvider>
            <MainInner>
              {children}
            </MainInner>
          </SidebarProvider>
          <QuickActionsFAB />
        </PrivacyProvider>
      </ToastProvider>
    </FinanceProvider>
  )
}
