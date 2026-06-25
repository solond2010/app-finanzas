"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react"
import Link from "next/link"

export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="rounded-full bg-red-500/10 p-5 ring-1 ring-red-500/20">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Algo salió mal</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Hubo un error inesperado. Puedes intentar de nuevo o volver al inicio.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} className="gap-2"><RotateCcw className="h-4 w-4" />Reintentar</Button>
        <Link href="/dashboard" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground active:scale-[0.97]">
          <ArrowLeft className="h-4 w-4" />Volver al inicio
        </Link>
      </div>
    </div>
  )
}
