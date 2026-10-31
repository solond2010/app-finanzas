// Enlaces de los emails de Supabase Auth (confirmar registro, entrar sin
// contraseña, recuperar acceso). Sin imports de servidor: lo usan las rutas,
// la página de login y los tests.
import type { EmailOtpType } from "@supabase/supabase-js"

const OTP_TYPES: readonly EmailOtpType[] = ["email", "signup", "magiclink", "recovery", "invite", "email_change"]

/** Solo acepta los tipos de enlace de email que conoce Supabase. */
export function parseOtpType(value: string | null | undefined): EmailOtpType | null {
  return value && (OTP_TYPES as readonly string[]).includes(value) ? (value as EmailOtpType) : null
}

/** Avisos que /login muestra según ?aviso= o ?error= tras pulsar un enlace. */
export type LinkNotice = { kind: "info" | "error"; text: string }

export function loginNotice(params: { get(name: string): string | null }): LinkNotice | null {
  const aviso = params.get("aviso")
  if (aviso === "confirmado") {
    return { kind: "info", text: "Tu email ya está confirmado ✅ Entra con tu email y tu contraseña." }
  }
  if (aviso === "enlace-usado") {
    return {
      kind: "info",
      text: "Este enlace ya se usó o ha caducado. Si ya confirmaste tu email, entra con tu contraseña. Si no, pide un enlace nuevo.",
    }
  }
  if (params.get("error") === "enlace") {
    return { kind: "error", text: "El enlace no es válido o ha caducado. Pide otro." }
  }
  return null
}

/** Texto del botón de /auth/confirm según el tipo de enlace. */
export function confirmCopy(type: EmailOtpType): { title: string; subtitle: string; button: string } {
  if (type === "email") {
    // "email" lo usan tanto el registro como el enlace para entrar.
    return { title: "Un último paso", subtitle: "Pulsa el botón para confirmar y entrar en Garra.", button: "Continuar" }
  }
  if (type === "recovery" || type === "magiclink") {
    return { title: "Un último paso", subtitle: "Pulsa el botón para entrar en Garra.", button: "Entrar en Garra" }
  }
  if (type === "email_change") {
    return { title: "Confirma tu nuevo email", subtitle: "Pulsa el botón para terminar el cambio.", button: "Confirmar cambio" }
  }
  return { title: "Confirma tu email", subtitle: "Pulsa el botón para activar tu cuenta y entrar.", button: "Confirmar mi email" }
}
