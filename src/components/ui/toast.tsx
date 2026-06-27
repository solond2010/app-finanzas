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
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm pointer-events-none [&>div]:pointer-events-auto">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg data-open:animate-in data-open:fade-in data-open:slide-in-from-right-5 data-closed:animate-out data-closed:fade-out data-closed:slide-out-to-right-5 ${t.type === "success" ? "bg-emerald-950/90 border-emerald-800/60 text-emerald-200 backdrop-blur-sm" : t.type === "error" ? "bg-red-950/90 border-red-800/60 text-red-200 backdrop-blur-sm" : "bg-zinc-900/90 border-zinc-700/60 text-zinc-200 backdrop-blur-sm"}`}>
            {t.type === "success" ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" /> : t.type === "error" ? <AlertCircle className="h-4 w-4 text-red-400 shrink-0" /> : <Info className="h-4 w-4 text-blue-400 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="shrink-0 rounded-lg p-1 opacity-60 hover:opacity-100 hover:bg-black/20 transition-all"><X className="h-3.5 w-3.5" /></button>
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
