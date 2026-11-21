"use client"

import { useInvestmentSyncStatus } from "@/lib/investments"
import { useSyncStatus } from "@/lib/store"
import { shouldShowSyncOfflineNotice, SYNC_OFFLINE_NOTICE } from "@/lib/sync-offline-notice"

/** Aviso visible en móvil y escritorio cuando un guardado queda pendiente por red. */
export function SyncOfflineNotice() {
  const finance = useSyncStatus()
  const investment = useInvestmentSyncStatus()
  if (!shouldShowSyncOfflineNotice({
    financeStatus: finance.status,
    financePending: finance.pendingSync,
    investmentStatus: investment.status,
  })) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--mobile-header-h)+0.5rem)] z-40 flex justify-center px-3 lg:top-4"
    >
      <p className="max-w-[min(100%,24rem)] rounded-full border border-amber-200/80 bg-amber-50/95 px-3.5 py-1.5 text-center text-xs font-medium leading-5 text-amber-900 shadow-sm backdrop-blur-md dark:border-amber-700/40 dark:bg-amber-950/90 dark:text-amber-100">
        {SYNC_OFFLINE_NOTICE}
      </p>
    </div>
  )
}
