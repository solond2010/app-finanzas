"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCcw } from "lucide-react"

export default function LoginError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="rounded-full bg-red-500/10 p-5 ring-1 ring-red-500/20">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Error al cargar</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          No se pudo cargar la página de inicio de sesión. Intenta de nuevo.
        </p>
      </div>
      <Button onClick={reset} className="gap-2"><RotateCcw className="h-4 w-4" />Reintentar</Button>
    </div>
  )
}
