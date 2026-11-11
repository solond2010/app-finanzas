"use client"

import { useEffect } from "react"
import { parseRecoveryHash } from "@/lib/auth-reset-hash"

// Si ConfirmationURL cae en la portada (Site URL) con el hash implicit,
// reenvía a /auth/reset conservando los tokens.
export function RecoveryHashRedirect() {
  useEffect(() => {
    const parsed = parseRecoveryHash(window.location.hash)
    if (parsed && "accessToken" in parsed && (parsed.type === "recovery" || parsed.type === "")) {
      window.location.replace("/auth/reset" + window.location.hash)
    }
  }, [])
  return null
}
