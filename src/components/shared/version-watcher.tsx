"use client"

import { useEffect, useState } from "react"
import { ArrowRight } from "@/components/icons"
import { decideUpdate, RUNNING_VERSION } from "@/lib/version-check"

const RELOADED_KEY = "garra-reloaded-for"
const INTERVAL_MS = 5 * 60 * 1000
const MIN_GAP_MS = 20 * 1000

// Es seguro recargar si no hay ningún diálogo/hoja abierto ni texto escrito
// sin guardar (un campo vacío con foco, como el del login, no cuenta).
function isSafeToReload() {
  if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-slot="dialog-content"], #mobile-more-menu')) return false
  const active = document.activeElement as HTMLElement | null
  if (active?.isContentEditable) return false
  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea")
  for (const field of fields) {
    if (field.readOnly || field.disabled) continue
    if (field.value !== field.defaultValue) return false
  }
  return true
}

function readReloadedFor() {
  try { return sessionStorage.getItem(RELOADED_KEY) } catch { return null }
}

export function VersionWatcher() {
  const [available, setAvailable] = useState<string | null>(null)

  useEffect(() => {
    if (RUNNING_VERSION === "dev") return
    let last = 0
    let busy = false
    const check = async () => {
      if (busy || document.visibilityState !== "visible" || Date.now() - last < MIN_GAP_MS) return
      busy = true
      last = Date.now()
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" })
        if (!res.ok) return
        const { version } = (await res.json()) as { version?: string }
        const decision = decideUpdate({ running: RUNNING_VERSION, remote: version, safe: isSafeToReload(), alreadyReloadedFor: readReloadedFor() })
        if (decision === "reload" && version) {
          try { sessionStorage.setItem(RELOADED_KEY, version) } catch {}
          window.location.reload()
        } else if (decision === "prompt" && version) {
          setAvailable(version)
        }
      } catch {
        // Sin conexión: se reintenta en la próxima comprobación.
      } finally {
        busy = false
      }
    }
    const onVisible = () => { if (document.visibilityState === "visible") void check() }
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) { last = 0; void check() } }
    const first = window.setTimeout(check, 4000)
    const timer = window.setInterval(check, INTERVAL_MS)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  if (!available) return null
  return (
    <div role="status" className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.75rem)] z-[70] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-primary/30 bg-popover/95 py-2 pl-4 pr-2 text-sm shadow-2xl backdrop-blur lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0">
      <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1 font-medium text-foreground">Nueva versión disponible</span>
      <button
        type="button"
        onClick={() => { try { sessionStorage.setItem(RELOADED_KEY, available) } catch {} ; window.location.reload() }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Actualizar <ArrowRight className="size-4" />
      </button>
    </div>
  )
}
