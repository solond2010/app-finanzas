import { Suspense } from "react"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { PasswordLoginForm } from "./password-login-form"
import { AccountLoginForm } from "./account-login-form"

// El modo (contraseña única o cuentas) se decide en el servidor en cada
// petición, según AUTH_MODE. Ver src/lib/auth-mode.ts.
export const dynamic = "force-dynamic"

export default function LoginPage() {
  const accounts = isSupabaseAuthEnabled()
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="relative hero-panel w-full max-w-sm rounded-[16px] p-8">
        <Suspense fallback={<div className="text-sm text-muted-foreground text-center py-8">Cargando...</div>}>
          {accounts ? <AccountLoginForm /> : <PasswordLoginForm />}
        </Suspense>
      </div>
    </div>
  )
}
