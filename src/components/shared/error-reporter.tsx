"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/report-error-client"

/** Escucha errores sueltos del navegador (fuera de React) y avisa a Moha. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError(event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason)
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])
  return null
}
