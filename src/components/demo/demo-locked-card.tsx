import { ArrowRight, Sparkles } from "@/components/icons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEMO_SIGNUP_HREF } from "@/lib/demo/constants"

/** Tarjeta que sustituye en la demo a lo que necesita una cuenta real. */
export function DemoLockedCard({ title, text }: { title: string; text: string }) {
  return (
    <Card className="border border-dashed border-[color-mix(in_oklch,var(--gold),transparent_60%)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-4 w-4" />{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{text}</p>
        <a href={DEMO_SIGNUP_HREF} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          Crea tu cuenta para usar esto
          <ArrowRight weight="bold" className="size-3.5" />
        </a>
      </CardContent>
    </Card>
  )
}
