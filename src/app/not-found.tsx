import Link from "next/link"
import { SearchX, ArrowLeft } from "lucide-react"

export default function GlobalNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-4 text-center">
      <div className="flex flex-col items-center gap-6">
        <div className="rounded-[16px] border border-border bg-card p-6">
          <div className="rounded-full bg-muted/50 p-5 ring-1 ring-border/30">
            <SearchX className="h-10 w-10 text-muted-foreground/50" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Página no encontrada</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            La página que buscas no existe o ha sido movida.
          </p>
        </div>
        <Link href="/dashboard" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97]">
          <ArrowLeft className="h-4 w-4" />Volver al inicio
        </Link>
      </div>
    </div>
  )
}
