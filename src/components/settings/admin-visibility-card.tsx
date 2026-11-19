import { cookies } from "next/headers"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck } from "@/components/icons"
import { HIDE_ADMIN_NAV_COOKIE, isHiddenAdminNavValue } from "@/lib/server/admin-nav-cookie"
import { cn } from "@/lib/utils"

/** Ajuste solo para el admin (componente de servidor): ocultar el menú en este dispositivo. */
export async function AdminVisibilityCard() {
  const hidden = isHiddenAdminNavValue((await cookies()).get(HIDE_ADMIN_NAV_COOKIE)?.value)

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4" />
          Administración
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Si le enseñas Garra a alguien en este dispositivo, oculta el enlace del menú. La página sigue ahí y puedes abrirla desde aquí.
        </p>
        <form action="/api/admin/menu" method="post" className="flex items-start justify-between gap-3 rounded-2xl bg-muted/30 p-4 ring-1 ring-border/20">
          <input type="hidden" name="hidden" value={hidden ? "0" : "1"} />
          <label htmlFor="hide-admin-nav" className="min-w-0 text-sm font-medium leading-5">
            Ocultar Administración del menú
          </label>
          <button
            id="hide-admin-nav"
            type="submit"
            role="switch"
            aria-checked={hidden}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              hidden ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-0.5 size-6 rounded-full bg-background shadow-sm transition-transform",
                hidden ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </button>
        </form>
        <Link
          href="/admin"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted sm:w-auto"
        >
          Abrir Administración
        </Link>
      </CardContent>
    </Card>
  )
}
