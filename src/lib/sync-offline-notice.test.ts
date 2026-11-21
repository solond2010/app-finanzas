import { describe, expect, it } from "vitest"
import { isSyncNetworkError, shouldShowSyncOfflineNotice, SYNC_OFFLINE_NOTICE } from "./sync-offline-notice"

describe("shouldShowSyncOfflineNotice", () => {
  it("solo avisa si hay cambios pendientes o inversiones sin subir", () => {
    expect(shouldShowSyncOfflineNotice({ financeStatus: "offline", financePending: false, investmentStatus: "idle" })).toBe(false)
    expect(shouldShowSyncOfflineNotice({ financeStatus: "offline", financePending: true, investmentStatus: "idle" })).toBe(true)
    expect(shouldShowSyncOfflineNotice({ financeStatus: "saved", financePending: false, investmentStatus: "offline" })).toBe(true)
    expect(shouldShowSyncOfflineNotice({ financeStatus: "error", financePending: true, investmentStatus: "idle" })).toBe(false)
    expect(shouldShowSyncOfflineNotice({ financeStatus: "syncing", financePending: true, investmentStatus: "syncing" })).toBe(false)
  })

  it("usa un texto breve que promete el reintento", () => {
    expect(SYNC_OFFLINE_NOTICE).toMatch(/Sin conexión/)
    expect(SYNC_OFFLINE_NOTICE).toMatch(/se guardará al volver/)
  })
})

describe("isSyncNetworkError", () => {
  it("trata la pérdida de red y los fallos de fetch como error de red", () => {
    expect(isSyncNetworkError(new Error("ok"), false)).toBe(true)
    expect(isSyncNetworkError(new Error("Failed to fetch"), true)).toBe(true)
    expect(isSyncNetworkError(new Error("NetworkError when attempting to fetch resource."), true)).toBe(true)
    expect(isSyncNetworkError(new Error("permission denied for table accounts"), true)).toBe(false)
  })
})
