"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Envelope } from "@phosphor-icons/react/dist/ssr"
import { Bug, ChatText, ChevronRight, Lightbulb, ShieldCheck } from "@/components/icons"
import { openFeedbackDialog } from "@/components/feedback/feedback-dialog"
import { useMe } from "@/lib/use-me"

/** «Ayuda y contacto» en Configuración, y acceso a Administración solo para Moha. */
export function FeedbackCard() {
  const { me } = useMe()
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold"><ChatText className="h-4 w-4" />Ayuda y contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">¿Tienes una duda, una idea o has visto un error? Escríbenos cuando quieras. Lo leemos todo con cariño.</p>
          <a href="mailto:contacto@migarra.app" className="flex items-center gap-3 rounded-[14px] border border-border bg-background px-3.5 py-3 no-underline transition-colors hover:border-primary/40">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-[var(--gold)]">
              <Envelope weight="regular" className="size-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--gold)]">contacto@migarra.app</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Si prefieres escribirnos por correo</span>
            </span>
          </a>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-auto min-h-11 min-w-[11rem] flex-1 justify-start gap-2 whitespace-normal py-2 text-left" onClick={() => openFeedbackDialog("fallo")}>
              <Bug className="size-4 text-red-500" />Avisar de un fallo
            </Button>
            <Button variant="outline" className="h-auto min-h-11 min-w-[11rem] flex-1 justify-start gap-2 whitespace-normal py-2 text-left" onClick={() => openFeedbackDialog("idea")}>
              <Lightbulb className="size-4 text-[var(--gold)]" />Proponer una idea
            </Button>
          </div>
        </CardContent>
      </Card>
      {me?.isAdmin && (
        <Link href="/admin" className="group block rounded-[var(--radius-xl,1rem)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Card className="border border-border transition-colors group-hover:border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold"><ShieldCheck className="h-4 w-4" />Administración<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Solo tú</span></CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Comentarios de los usuarios y errores recientes de la app.</p>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  )
}
