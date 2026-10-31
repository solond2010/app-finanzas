import "server-only"

// Emails a Moha (comentarios nuevos). Preparado para Resend: basta con
// añadir en Vercel RESEND_API_KEY, EMAIL_FROM (p. ej. «Garra <hola@tudominio>»,
// con el dominio verificado en Resend) y FEEDBACK_EMAIL_TO. Sin esas tres
// variables no se envía nada y el comentario queda guardado igualmente en
// Supabase (Configuración → Administración). Ver docs/emails-resend.md.

export function ownerEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.FEEDBACK_EMAIL_TO)
}

/** Envía un email de texto a Moha. Nunca lanza: devuelve si se envió. */
export async function notifyOwner(subject: string, text: string): Promise<boolean> {
  if (!ownerEmailConfigured()) return false
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: (process.env.FEEDBACK_EMAIL_TO ?? "").split(",").map((v) => v.trim()).filter(Boolean),
        subject: subject.slice(0, 150),
        text,
      }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) console.warn("[notify] Resend respondió", res.status)
    return res.ok
  } catch (error) {
    console.warn("[notify] No se pudo enviar el email", error instanceof Error ? error.message : "")
    return false
  }
}
