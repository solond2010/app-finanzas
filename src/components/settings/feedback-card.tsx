"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bug, ChatText, ChevronRight, Lightbulb, ShieldCheck } from "@/components/icons"
import { openFeedbackDialog } from "@/components/feedback/feedback-dialog"
import { useMe } from "@/lib/use-me"

/** «Ayúdanos a mejorar» en Configuración, y acceso a Administración solo para Moha. */
export function FeedbackCard() {
  const { me } = useMe()
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold"><ChatText className="h-4 w-4" />Ayúdanos a mejorar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">¿Algo no funciona o echas algo en falta? Cuéntanoslo en dos toques. Lo leemos todo.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" className="h-11 justify-start gap-2" onClick={() => openFeedbackDialog("fallo")}>
              <Bug className="size-4 text-red-500" />Avisar de un fallo
            </Button>
            <Button variant="outline" className="h-11 justify-start gap-2" onClick={() => openFeedbackDialog("idea")}>
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
