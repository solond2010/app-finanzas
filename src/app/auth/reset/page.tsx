import { redirect } from "next/navigation"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { createSupabaseRouteClient } from "@/lib/server/request-context"
import { ResetPasswordForm } from "./reset-password-form"

// Tras verificar el enlace de recuperación (botón en /auth/confirm). Hace
// falta una sesión ya abierta en ESTE navegador.
export const dynamic = "force-dynamic"

export default async function ResetPasswordPage() {
  if (!isSupabaseAuthEnabled()) redirect("/login")
  const supabase = await createSupabaseRouteClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect("/login?aviso=enlace-usado")
  return <ResetPasswordForm />
}
