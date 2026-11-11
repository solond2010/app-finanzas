"use client"

import type { CheckoutOption } from "@/lib/billing/plans"

/** Abre Stripe Checkout y devuelve la URL, o un error para mostrar al usuario. */
export async function startCheckout(option: CheckoutOption): Promise<{ url?: string; error?: string }> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ option }),
  })
  const body = await res.json().catch(() => null)
  if (res.ok && typeof body?.url === "string") return { url: body.url }
  return { error: typeof body?.error === "string" ? body.error : "No se pudo abrir el pago" }
}
