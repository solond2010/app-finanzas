"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { QuickActionsFAB } from "@/components/layout/quick-actions"
import { GoalsEditor } from "@/components/goals/goals-editor"
import { LimitWatcher } from "@/components/layout/limit-watcher"
import { FinanceProvider } from "@/lib/store"
import { InvestmentsProvider } from "@/lib/investments"
import { ToastProvider } from "@/components/ui/toast"
import { PrivacyProvider } from "@/lib/privacy"
import { SidebarProvider, useSidebar } from "@/lib/sidebar"
import { cn } from "@/lib/utils"
import { ensureLocalCacheOwnerOnce } from "@/lib/local-owner"

function MainInner({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={cn(
        // lg:pb-24: deja sitio al FAB (56px + margen) para que al llegar al
        // final de la página no tape la última fila de una tabla o un total.
        "min-h-screen min-w-0 flex-1 overflow-x-hidden px-3 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1.25rem)] pt-[calc(var(--mobile-header-h)+1rem)] animate-in fade-in duration-500 transition-[margin] sm:px-6 lg:px-8 lg:pb-24 lg:pt-8 2xl:px-10",
        open ? "lg:ml-52" : "lg:ml-16"
      )}>
        <div className="mx-auto w-full min-w-0 max-w-[1840px]">
          {children}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  )
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // Debe ir ANTES de que FinanceProvider/InvestmentsProvider lean localStorage
  // (sus efectos corren después del primer render): si en este navegador ha
  // entrado otra cuenta, se vacía la copia local de la anterior.
  ensureLocalCacheOwnerOnce()
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
            <GoalsEditor />
              <LimitWatcher />
          </PrivacyProvider>
        </ToastProvider>
      </InvestmentsProvider>
    </FinanceProvider>
  )
}
