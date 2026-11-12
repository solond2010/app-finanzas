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
  // de Chrome en Android. overflow-x-clip va SOLO en este contenedor exterior
  // (crece con el contenido, height auto): en un hijo flex con min-h-0 +
  // overflow-x-clip el overflow-y pasa a auto/clip y aparece un scroll interno
  // que lucha con el del documento (iOS y Chrome Android). El aviso de demo
  // va en el flujo, sin fixed ni sticky. El margen del sidebar se aplica al
  // bloque entero para que el aviso no se meta debajo.
  return (
    <div className="flex min-h-svh overflow-x-clip">
      <Sidebar />
      <div className={cn("flex min-w-0 flex-1 flex-col transition-[margin]", open ? "lg:ml-52" : "lg:ml-16")}>
        {demo && <DemoBanner />}
        <main className={cn(
          // lg:pb-24: deja sitio al FAB (56px + margen) para que al llegar al
          // final de la página no tape la última fila de una tabla o un total.
          "min-w-0 flex-1 px-3 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1.25rem)] animate-in fade-in duration-500 sm:px-6 lg:px-8 lg:pb-24 lg:pt-8 2xl:px-10",
          demo ? "pt-4" : "pt-[calc(var(--mobile-header-h)+1rem)]",
        )}>
          <div className="mx-auto w-full min-w-0 max-w-[1840px]">
            {children}
          </div>
        </main>
      </div>
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
