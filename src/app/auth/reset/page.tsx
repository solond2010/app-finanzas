import { redirect } from "next/navigation"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { ResetPasswordForm } from "./reset-password-form"

// Destino de {{ .ConfirmationURL }} (flujo implicit: tokens en el hash) y
// también de token_hash / ?code, que ya llegan con sesión en cookie.
export const dynamic = "force-dynamic"

export default function ResetPasswordPage() {
  if (!isSupabaseAuthEnabled()) redirect("/login")
  return <ResetPasswordForm />
}
