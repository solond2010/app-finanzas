"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { QuickActionsFAB } from "@/components/layout/quick-actions"
import { FinanceProvider } from "@/lib/store"
import { ToastProvider } from "@/components/ui/toast"
import { usePathname } from "next/navigation"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <FinanceProvider>
      <ToastProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="ml-64 flex-1 p-8">
            <div key={pathname} className="animate-in fade-in duration-500">
              {children}
            </div>
          </main>
        </div>
        <QuickActionsFAB />
      </ToastProvider>
    </FinanceProvider>
  )
}
