// Aviso discreto cuando un guardado no llega a la nube por red.
// La cola de sincronización (diario local + upsert por id) ya evitan
// duplicar movimientos; aquí solo se decide si se muestra el aviso.

export type SyncNoticeStatus = "idle" | "syncing" | "saved" | "error" | "offline"

export const SYNC_OFFLINE_NOTICE = "Sin conexión, se guardará al volver."

export function shouldShowSyncOfflineNotice(input: {
  financeStatus: SyncNoticeStatus
  financePending: boolean
  investmentStatus: SyncNoticeStatus
}): boolean {
  if (input.financeStatus === "offline" && input.financePending) return true
  if (input.investmentStatus === "offline") return true
  return false
}

/** Fallo de red (navegador sin conexión o fetch caído), no un error de API. */
export function isSyncNetworkError(error: unknown, online = typeof navigator === "undefined" ? true : navigator.onLine): boolean {
  if (!online) return true
  const message = error instanceof Error ? error.message : String(error ?? "")
  return /failed to fetch|networkerror|load failed|err_internet|err_name_not_resolved|failed to load|network request failed/i.test(message)
}
