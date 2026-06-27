"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { QuickActionsFAB } from "@/components/layout/quick-actions"
import { FinanceProvider } from "@/lib/store"
import { ToastProvider } from "@/components/ui/toast"
import { PrivacyProvider } from "@/lib/privacy"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <ToastProvider>
        <PrivacyProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-h-screen flex-1 lg:ml-64 pt-[var(--mobile-header-h)] lg:pt-8 p-3 sm:p-6 lg:p-8 animate-in fade-in duration-500">
            {children}
          </main>
        </div>
        <QuickActionsFAB />
      </PrivacyProvider>
      </ToastProvider>
    </FinanceProvider>
  )
}
