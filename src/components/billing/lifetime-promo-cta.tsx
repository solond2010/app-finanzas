"use client"

import { useEffect, useState, type FormEvent } from "react"

const STORAGE_KEY = "garra_promo_code"

export function persistPromoCode(value: string) {
  const trimmed = value.trim()
  try {
    if (trimmed) sessionStorage.setItem(STORAGE_KEY, trimmed)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* modo privado o almacenamiento no disponible */
  }
}

export function readStoredPromoCode(): string {
  try {
    const query = new URLSearchParams(window.location.search).get("codigo")
    if (query && query.trim()) {
      persistPromoCode(query)
      return query.trim()
    }
    return sessionStorage.getItem(STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

export function LifetimePromoCta({
  signedIn,
  href,
  className,
}: {
  signedIn: boolean
  href: string
  className: string
}) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setCode(readStoredPromoCode()) }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    persistPromoCode(code)
    if (!signedIn) {
      window.location.href = href
      return
    }
    setBusy(true)
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: "pro_lifetime", codigo: code }),
      })
      const body = await response.json().catch(() => null)
      if (response.ok && typeof body?.url === "string") {
        window.location.href = body.url
        return
      }
      setError(typeof body?.error === "string" ? body.error : "No se pudo abrir el pago")
    } catch {
      setError("No se pudo abrir el pago")
    }
    setBusy(false)
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <label className="block text-left text-xs font-medium leading-5 text-[#8C96A3]">
        ¿Tienes un código?
        <input
          type="text"
          name="codigo"
          autoComplete="off"
          spellCheck={false}
          value={code}
          onChange={(event) => { setCode(event.target.value); setError(null) }}
          className="mt-1.5 min-h-11 w-full rounded-xl border border-[#232B36] bg-[#0B0F14] px-3 text-sm font-medium text-[#EEF1F4] outline-none ring-0 placeholder:text-[#8C96A3] focus:border-[#F5A524]"
        />
      </label>
      {error && <p className="text-left text-xs leading-5 text-[#E85D4C]" role="alert">{error}</p>}
      <button type="submit" className={className} disabled={busy}>
        {busy ? "Abriendo…" : "Hazte Pro"}
      </button>
    </form>
  )
}
