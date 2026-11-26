import { GarraMark } from "@/components/brand/garra-logo"

export function OauthConsentForm({
  consentId,
  clientName,
  email,
}: {
  consentId: string
  clientName: string
  email: string | null
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <GarraMark className="size-10" title="Garra" />
        <div className="min-w-0">
          <h1 className="font-heading text-lg font-semibold leading-tight">¿Conectar con Garra?</h1>
          <p className="mt-1 truncate text-xs text-muted-foreground">{email ?? "Tu cuenta"}</p>
        </div>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        <strong className="font-medium text-foreground">{clientName}</strong> podrá consultar tus cuentas y categorías, y apuntar gastos o ingresos en tu cuenta de Garra.
      </p>
      <form action="/oauth/consent" method="post" className="flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="consent" value={consentId} />
        <button
          type="submit"
          name="decision"
          value="deny"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-input px-5 text-sm font-medium transition-colors hover:bg-muted/40"
        >
          Cancelar
        </button>
        <button
          type="submit"
          name="decision"
          value="allow"
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:brightness-110"
        >
          Autorizar
        </button>
      </form>
    </div>
  )
}
