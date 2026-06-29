"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { QuickActionsFAB } from "@/components/layout/quick-actions"
import { FinanceProvider } from "@/lib/store"
import { InvestmentsProvider } from "@/lib/investments"
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
        "min-h-screen flex-1 px-3 sm:px-6 lg:px-8 pt-[var(--mobile-header-h)] lg:pt-8 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:pb-8 animate-in fade-in duration-500 transition-all",
        open ? "lg:ml-64" : "lg:ml-16"
      )}>
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <InvestmentsProvider>
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
      </InvestmentsProvider>
    </FinanceProvider>
  )
}
