"use client"

import { useEffect } from "react"
import { parseRecoveryHash } from "@/lib/auth-reset-hash"

// Si el hash implicit cae en la portada o en /login (p. ej. un 307 antiguo
// o la Site URL), reenvía a /auth/reset conservando los tokens.
export function RecoveryHashRedirect() {
  useEffect(() => {
    if (window.location.pathname === "/auth/reset") return
    const parsed = parseRecoveryHash(window.location.hash)
    if (parsed && "accessToken" in parsed && (parsed.type === "recovery" || parsed.type === "")) {
      window.location.replace("/auth/reset" + window.location.hash)
    }
  }, [])
  return null
}
