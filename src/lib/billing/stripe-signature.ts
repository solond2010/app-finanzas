import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Comprueba la cabecera Stripe-Signature (t=…,v1=…) de un webhook:
 * HMAC-SHA256 de "<t>.<cuerpo>" con el secreto del endpoint, con margen
 * de 5 minutos para evitar reenvíos antiguos.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): boolean {
  if (!header || !secret) return false
  let timestamp: number | null = null
  const signatures: string[] = []
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((s) => s?.trim())
    if (key === "t" && value) timestamp = Number(value)
    if (key === "v1" && value) signatures.push(value)
  }
  if (timestamp === null || !Number.isFinite(timestamp) || signatures.length === 0) return false
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex"), "utf8")
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "utf8")
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
