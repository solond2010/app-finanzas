"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { QuickActionsFAB } from "@/components/layout/quick-actions"
import { FinanceProvider } from "@/lib/store"
import { ToastProvider } from "@/components/ui/toast"
import { PrivacyProvider } from "@/lib/privacy"
import { SidebarProvider, useSidebar } from "@/lib/sidebar"
import { cn } from "@/lib/utils"
import { Menu } from "lucide-react"

function MainInner({ children }: { children: React.ReactNode }) {
  const { open, toggle } = useSidebar()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={cn(
        "min-h-screen flex-1 pt-[var(--mobile-header-h)] lg:pt-8 p-3 sm:p-6 lg:p-8 animate-in fade-in duration-500 transition-all",
        open ? "lg:ml-64" : "lg:ml-0"
      )}>
        <button
          onClick={toggle}
          className="fixed top-3 left-3 z-30 hidden lg:flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-90 touch-manipulation press-effect-subtle"
          aria-label={open ? "Colapsar menú" : "Abrir menú"}
        >
          <Menu className="h-5 w-5" />
        </button>
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
