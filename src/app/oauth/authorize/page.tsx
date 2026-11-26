import type { ReactNode } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { getDataContext } from "@/lib/server/request-context"
import { safeNextPath } from "@/lib/auth-redirect"
import { getOauthService } from "@/lib/oauth/server"
import { GarraLogo } from "@/components/brand/garra-logo"
import { OauthConsentForm } from "@/components/oauth/consent-form"
import { CONNECTORS_PRO_ERROR, CONNECTORS_PRO_HREF, CONNECTORS_PRO_NOTICE } from "@/lib/billing/connectors-access"
import { userCanUseConnectors } from "@/lib/server/connectors-access"

export const dynamic = "force-dynamic"

export default async function OauthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const query = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  )
  const returnTo = safeNextPath(`/oauth/authorize?${new URLSearchParams(query as Record<string, string>).toString()}`, "/oauth/authorize")

  if (!isSupabaseAuthEnabled()) {
    return (
      <ConsentShell>
        <p className="text-sm text-muted-foreground">El inicio de sesión con cuentas no está disponible ahora.</p>
      </ConsentShell>
    )
  }

  const ctx = await getDataContext()
  if (!ctx) {
    redirect(`/login?redirect=${encodeURIComponent(returnTo)}`)
  }

  if (!(await userCanUseConnectors(ctx.userId))) {
    return (
      <ConsentShell>
        <h1 className="font-heading text-lg font-semibold">{CONNECTORS_PRO_NOTICE}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{CONNECTORS_PRO_ERROR}</p>
        <Link href={CONNECTORS_PRO_HREF} className="mt-6 inline-flex text-sm font-medium underline underline-offset-2">Ver planes en Precios</Link>
      </ConsentShell>
    )
  }

  const started = await getOauthService().startAuthorization(ctx.userId, query)
  if ("error" in started) {
    return (
      <ConsentShell>
        <h1 className="font-heading text-lg font-semibold">No se puede conectar</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{started.error_description}</p>
        <Link href="/configuracion#mcp" className="mt-6 inline-flex text-sm font-medium underline underline-offset-2">Volver a Ajustes</Link>
      </ConsentShell>
    )
  }
  if ("redirectTo" in started) {
    redirect(started.redirectTo)
  }

  return (
    <ConsentShell>
      <OauthConsentForm
        consentId={started.pending.id}
        clientName={started.client.clientName}
        email={ctx.email}
      />
    </ConsentShell>
  )
}

function ConsentShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background p-4">
      <div className="relative hero-panel w-full max-w-sm rounded-[16px] p-8">
        <GarraLogo tagline />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
