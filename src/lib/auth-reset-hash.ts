// Tokens del flujo implicit de recuperación (plantilla por defecto de
// Supabase: ConfirmationURL redirige a /auth/reset#access_token=…).
export type RecoveryHash =
  | { accessToken: string; refreshToken: string; type: string }
  | { error: string }

export function parseRecoveryHash(hash: string): RecoveryHash | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash
  if (!raw) return null
  const params = new URLSearchParams(raw)
  const err = params.get("error_description") || params.get("error_code") || params.get("error")
  if (err) return { error: err }
  const accessToken = params.get("access_token")
  const refreshToken = params.get("refresh_token")
  if (!accessToken || !refreshToken) return null
  return { accessToken, refreshToken, type: params.get("type") ?? "" }
}
