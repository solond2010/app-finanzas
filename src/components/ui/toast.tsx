"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { X, CheckCircle, AlertCircle, Info } from "@/components/icons"

interface ToastAction { label: string; onClick: () => void }
interface ToastOptions { action?: ToastAction; duration?: number }
interface Toast {
  id: number
  message: string
  type: "success" | "error" | "info"
  action?: ToastAction
}

const ToastContext = createContext<{ toast: (msg: string, type?: Toast["type"], options?: ToastOptions) => void } | null>(null)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast["type"] = "info", options?: ToastOptions) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type, action: options?.action }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), options?.duration ?? (options?.action ? 6000 : 3500))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* role=status + aria-live: los avisos ("Gasto registrado"…) se anuncian
          a lectores de pantalla al aparecer. Posicionado POR ENCIMA del FAB
          (que vive en la misma esquina): antes el toast tapaba el botón "+"
          durante sus 3,5s — y en móvil pisaba la barra de navegación. */}
      <div
        role="status"
        aria-live="polite"
        className="fixed right-5 bottom-[calc(var(--bottom-nav-h)+5.25rem)] lg:right-8 lg:bottom-24 z-[60] flex flex-col gap-2.5 max-w-sm pointer-events-none [&>div]:pointer-events-auto"
      >
        {toasts.map((t, idx) => (
          <div
            key={t.id}
            className={`stagger-fade-fast flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-2xl backdrop-blur-xl ${
              t.type === "success"
                ? "bg-emerald-50/95 border-emerald-200 text-emerald-900 dark:bg-emerald-950/90 dark:border-emerald-700/50 dark:text-emerald-100"
                : t.type === "error"
                  ? "bg-red-50/95 border-red-200 text-red-900 dark:bg-red-950/90 dark:border-red-700/50 dark:text-red-100"
                  : "bg-amber-50/95 border-amber-200 text-amber-950 dark:bg-amber-950/90 dark:border-amber-700/50 dark:text-amber-100"
            }`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {t.type === "success"
              ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20"><CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /></span>
              : t.type === "error"
                ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20"><AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /></span>
                : <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: "color-mix(in oklab, var(--gold), transparent 80%)" }}><Info className="h-3.5 w-3.5" style={{ color: "var(--gold)" }} /></span>
            }
            <span className="flex-1 font-medium">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => { t.action?.onClick(); setToasts((prev) => prev.filter((x) => x.id !== t.id)) }}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-bold text-[var(--gold)] underline-offset-2 hover:bg-black/5 dark:hover:bg-black/30 hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} aria-label="Cerrar aviso" className="shrink-0 rounded-xl p-1.5 opacity-50 hover:opacity-100 hover:bg-black/5 dark:hover:bg-black/30 transition-all"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
