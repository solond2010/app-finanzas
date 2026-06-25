import Link from "next/link"
import { SearchX, ArrowLeft } from "lucide-react"

export default function MainNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="rounded-full bg-muted/50 p-5 ring-1 ring-border/30">
        <SearchX className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Página no encontrada</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          La página que buscas no existe o ha sido movida.
        </p>
      </div>
      <Link href="/dashboard" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97]">
        <ArrowLeft className="h-4 w-4" />Volver al inicio
      </Link>
    </div>
  )
}
