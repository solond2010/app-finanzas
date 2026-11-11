import "server-only"
import { createClient } from "@supabase/supabase-js"

// Cliente solo para generar el ConfirmationURL de reset (plantilla por
// defecto de Supabase). flowType implicit: el redirect llega a /auth/reset
// con #access_token, sin code_verifier del navegador que pidió el email.
// No persiste sesión.
export function createImplicitMailerClient() {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("Falta SUPABASE_URL o SUPABASE_ANON_KEY")
  return createClient(url, anonKey, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
