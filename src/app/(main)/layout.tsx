"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { QuickActionsFAB } from "@/components/layout/quick-actions"
import { FinanceProvider } from "@/lib/store"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="ml-64 flex-1 p-8">{children}</main>
      </div>
      <QuickActionsFAB />
    </FinanceProvider>
  )
}
