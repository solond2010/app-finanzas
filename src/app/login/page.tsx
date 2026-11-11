import { Suspense } from "react"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { isGoogleAuthAvailable } from "@/lib/server/google-auth"
import { PasswordLoginForm } from "./password-login-form"
import { AccountLoginForm } from "./account-login-form"
import { DemoEntryButton } from "@/components/demo/demo-entry-button"

// El modo (contraseña única o cuentas) se decide en el servidor en cada
// petición, según AUTH_MODE. Ver src/lib/auth-mode.ts.
export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const accounts = isSupabaseAuthEnabled()
  const googleEnabled = accounts ? await isGoogleAuthAvailable() : false
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="relative hero-panel w-full max-w-sm rounded-[16px] p-8">
        <Suspense fallback={<div className="text-sm text-muted-foreground text-center py-8">Cargando...</div>}>
          {accounts ? <AccountLoginForm googleEnabled={googleEnabled} /> : <PasswordLoginForm />}
        </Suspense>
        {!accounts && <DemoEntryButton className="mt-6" />}
        <nav aria-label="Información legal" className="mt-6 flex justify-center gap-4 text-xs text-muted-foreground">
          <a href="/privacidad" className="hover:text-foreground hover:underline">Privacidad</a>
          <span aria-hidden>·</span>
          <a href="/terminos" className="hover:text-foreground hover:underline">Condiciones</a>
        </nav>
      </div>
    </div>
  )
}
