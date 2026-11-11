import { redirect } from "next/navigation"
import { GarraLogo } from "@/components/brand/garra-logo"
import { confirmCopy, defaultNextForOtp, parseOtpType } from "@/lib/auth-links"
import { safeNextPath } from "@/lib/auth-redirect"

// Destino de los enlaces de los emails (plantillas con token_hash). A propósito
// NO verifica el enlace al abrirlo: los escáneres de correo (Gmail, Outlook)
// abren los enlaces antes que la persona y lo gastarían. Se verifica al pulsar
// el botón (POST a /auth/confirm/verify), y funciona en cualquier navegador o
// móvil porque no depende de nada guardado en el navegador del registro.
export const dynamic = "force-dynamic"

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const tokenHash = typeof sp.token_hash === "string" ? sp.token_hash : ""
  const type = parseOtpType(typeof sp.type === "string" ? sp.type : null)
  if (!tokenHash || !type) redirect("/login?error=enlace")
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null, defaultNextForOtp(type))
  const copy = confirmCopy(type)

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="relative hero-panel w-full max-w-sm rounded-[16px] p-8">
        <div className="flex flex-col gap-6">
          <GarraLogo tagline className="justify-center" />
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
          <form method="post" action="/auth/confirm/verify" className="flex flex-col">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97]"
            >
              {copy.button}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
