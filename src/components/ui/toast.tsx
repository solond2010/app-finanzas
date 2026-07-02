"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { X, CheckCircle, AlertCircle, Info } from "lucide-react"

interface Toast {
  id: number
  message: string
  type: "success" | "error" | "info"
}

const ToastContext = createContext<{ toast: (msg: string, type?: Toast["type"]) => void } | null>(null)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2.5 max-w-sm pointer-events-none [&>div]:pointer-events-auto">
        {toasts.map((t, idx) => (
          <div
            key={t.id}
            className={`stagger-fade-fast flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-2xl backdrop-blur-xl ${
              t.type === "success"
                ? "bg-emerald-950/90 border-emerald-700/50 text-emerald-100"
                : t.type === "error"
                  ? "bg-red-950/90 border-red-700/50 text-red-100"
                  : "bg-amber-950/90 border-amber-700/50 text-amber-100"
            }`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {t.type === "success"
              ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20"><CheckCircle className="h-3.5 w-3.5 text-emerald-400" /></span>
              : t.type === "error"
                ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20"><AlertCircle className="h-3.5 w-3.5 text-red-400" /></span>
                : <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: "color-mix(in oklch, var(--gold), transparent 80%)" }}><Info className="h-3.5 w-3.5" style={{ color: "var(--gold)" }} /></span>
            }
            <span className="flex-1 font-medium">{t.message}</span>
            <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="shrink-0 rounded-xl p-1.5 opacity-50 hover:opacity-100 hover:bg-black/30 transition-all"><X className="h-3 w-3" /></button>
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
