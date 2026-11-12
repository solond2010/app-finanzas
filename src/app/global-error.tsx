"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/report-error-client"
import "./globals.css"

// Último recurso: si falla hasta el diseño principal. Lleva su propio
// <html>/<body> y estilos mínimos, y avisa a Moha del error.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { reportClientError(error, { digest: error.digest }) }, [error])

  return (
    <html lang="es" className="dark">
      <body className="flex min-h-svh items-center justify-center bg-background p-6 font-sans text-foreground antialiased">
        <title>Algo salió mal · Garra</title>
        <div className="flex max-w-sm flex-col items-center gap-5 text-center">
          <div className="rounded-full bg-red-500/10 p-5 ring-1 ring-red-500/20">
            <svg width="32" height="32" viewBox="0 0 256 256" fill="currentColor" className="text-red-500" aria-hidden="true"><path d="M236.8 188.09 149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19 23.51 23.51 0 0 0 .02-23.72ZM120 104a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0Zm8 88a12 12 0 1 1 12-12 12 12 0 0 1-12 12Z" /></svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Algo salió mal</h1>
            <p className="text-sm text-muted-foreground">Ya nos ha llegado el aviso y lo miramos. Prueba otra vez o vuelve al inicio.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => unstable_retry()} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Reintentar</button>
            <a href="/dashboard" className="flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium">Volver al inicio</a>
          </div>
        </div>
      </body>
    </html>
  )
}
