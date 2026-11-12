"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { QuickActionsFAB } from "@/components/layout/quick-actions"
import { FeedbackDialog } from "@/components/feedback/feedback-dialog"
import { GoalsEditor } from "@/components/goals/goals-editor"
import { LimitWatcher } from "@/components/layout/limit-watcher"
import { FinanceProvider } from "@/lib/store"
import { InvestmentsProvider } from "@/lib/investments"
import { ToastProvider } from "@/components/ui/toast"
import { PrivacyProvider } from "@/lib/privacy"
import { SidebarProvider, useSidebar } from "@/lib/sidebar"
import { cn } from "@/lib/utils"
import { ensureLocalCacheOwnerOnce } from "@/lib/local-owner"
import { enableDemoMode } from "@/lib/demo/runtime"
import { DemoProvider } from "@/lib/demo/context"
import { DemoBanner } from "@/components/demo/demo-banner"
import { FeedbackNotificationsProvider } from "@/components/feedback/feedback-notifications"

function MainInner({ children, demo }: { children: React.ReactNode; demo: boolean }) {
  const { open } = useSidebar()

  // min-h-svh (no 100vh/100dvh): la altura no cambia al ocultar la barra
  // de Chrome en Android, que si no hace temblar fichas y gráfica.
  // overflow-x-clip (no hidden): hidden convierte overflow-y en auto y
  // puede crear un scroll interno que lucha con el del documento.
  return (
    <div className="flex min-h-svh">
      {demo && <DemoBanner sidebarOpen={open} />}
      <Sidebar />
      <main className={cn(
        // lg:pb-24: deja sitio al FAB (56px + margen) para que al llegar al
        // final de la página no tape la última fila de una tabla o un total.
        "min-h-svh min-w-0 flex-1 overflow-x-clip px-3 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1.25rem)] pt-[calc(var(--mobile-header-h)+1rem)] animate-in fade-in duration-500 transition-[margin] sm:px-6 lg:px-8 lg:pb-24 lg:pt-8 2xl:px-10",
        open ? "lg:ml-52" : "lg:ml-16"
      )}>
        <div className="mx-auto w-full min-w-0 max-w-[1840px]">
          {demo && <div aria-hidden className="h-12 lg:h-14" />}
          {children}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  )
}

export function MainShell({ children, demo }: { children: React.ReactNode; demo: boolean }) {
  if (demo) {
    // Demo: antes de que ningún provider lea localStorage o llame a /api,
    // se pasa todo a memoria (ver src/lib/demo/runtime.ts). La copia local
    // de un usuario real de este navegador no se lee ni se toca.
    enableDemoMode()
  } else {
    // Debe ir ANTES de que FinanceProvider/InvestmentsProvider lean localStorage
    // (sus efectos corren después del primer render): si en este navegador ha
    // entrado otra cuenta, se vacía la copia local de la anterior.
    ensureLocalCacheOwnerOnce()
  }
  return (
    <DemoProvider demo={demo}>
    <FinanceProvider>
      <InvestmentsProvider>
        <ToastProvider>
          <FeedbackNotificationsProvider enabled={!demo}>
          <PrivacyProvider>
            <SidebarProvider>
              <MainInner demo={demo}>
                {children}
              </MainInner>
            </SidebarProvider>
            <QuickActionsFAB />
            <GoalsEditor />
            <LimitWatcher />
            <FeedbackDialog />
          </PrivacyProvider>
          </FeedbackNotificationsProvider>
        </ToastProvider>
      </InvestmentsProvider>
    </FinanceProvider>
    </DemoProvider>
  )
}
