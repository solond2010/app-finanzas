import "server-only"
import { supabaseServer } from "@/lib/supabase-server"
import { asExistingPlan, mergePlanPatch, type PlanPatch } from "@/lib/billing/webhook-plan"
import {
  buildPaidProWelcomeEmail,
  missingProWelcomeEnv,
  proWelcomeEmailConfigured,
  proWelcomeIdempotencyKey,
  resultingPlanAfterPatch,
  shouldClaimPaidProWelcome,
  type PaidProWelcomeKind,
  type WelcomePlanLike,
  PRO_WELCOME_FROM,
} from "@/lib/billing/pro-welcome"
import type { UserPlanRow } from "@/lib/server/billing"

type ClaimState = "claimed" | "unsent" | "already_sent" | "unavailable"

const TABLE_MISSING = /pro_welcome_emails|schema cache|does not exist/i

/** Envía el email de bienvenida Pro de pago, como mucho una vez por usuario. Nunca lanza. */
export async function maybeSendPaidProWelcome(
  userId: string,
  existing: UserPlanRow | WelcomePlanLike | null,
  patch: PlanPatch,
): Promise<void> {
  try {
    const state = await resolveWelcomeClaim(userId, existing, patch)
    if (state === "already_sent" || state === "unavailable") return
    if (!proWelcomeEmailConfigured()) {
      if (missingProWelcomeEnv().length) {
        console.warn("[billing] Email de bienvenida Pro omitido: falta", missingProWelcomeEnv().join(", "))
      }
      return
    }
    const email = await loadUserEmail(userId)
    if (!email) {
      console.warn("[billing] Email de bienvenida Pro omitido: el usuario no tiene email")
      return
    }
    const kind = await loadClaimKind(userId)
    if (!kind) return
    const sent = await sendProWelcomeEmail(email, kind, userId)
    if (sent) await markProWelcomeSent(userId)
  } catch (error) {
    console.warn("[billing] Email de bienvenida Pro:", error instanceof Error ? error.message : error)
  }
}

async function resolveWelcomeClaim(
  userId: string,
  existing: UserPlanRow | WelcomePlanLike | null,
  patch: PlanPatch,
): Promise<ClaimState> {
  const current = await readWelcomeRow(userId)
  if (current === "unavailable") return "unavailable"
  if (current?.sent_at) return "already_sent"
  if (current) return "unsent"
  const kind = shouldClaimPaidProWelcome({
    existing,
    merged: resultingPlanAfterPatch(existing, mergePlanPatch(asExistingPlan(existing ? { plan: existing.plan ?? "free", source: existing.source ?? "stripe" } : null), patch)),
    alreadyClaimed: false,
  })
  if (!kind) return "already_sent"
  return claimProWelcomeEmail(userId, kind)
}

async function readWelcomeRow(userId: string): Promise<{ sent_at: string | null; kind: string } | null | "unavailable"> {
  const { data, error } = await supabaseServer
    .from("pro_welcome_emails")
    .select("sent_at, kind")
    .eq("user_id", userId)
    .maybeSingle()
  if (error && TABLE_MISSING.test(error.message)) return "unavailable"
  if (error) throw new Error(error.message)
  return data as { sent_at: string | null; kind: string } | null
}

async function claimProWelcomeEmail(userId: string, kind: PaidProWelcomeKind): Promise<ClaimState> {
  const { error } = await supabaseServer.from("pro_welcome_emails").insert({ user_id: userId, kind })
  if (error && /duplicate|unique/i.test(error.message)) {
    const current = await readWelcomeRow(userId)
    if (current === "unavailable") return "unavailable"
    if (current?.sent_at) return "already_sent"
    return "unsent"
  }
  if (error && TABLE_MISSING.test(error.message)) return "unavailable"
  if (error) throw new Error(error.message)
  return "claimed"
}

async function loadClaimKind(userId: string): Promise<PaidProWelcomeKind | null> {
  const current = await readWelcomeRow(userId)
  if (!current || current === "unavailable") return null
  return current.kind === "lifetime" ? "lifetime" : current.kind === "monthly" ? "monthly" : null
}

async function markProWelcomeSent(userId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("pro_welcome_emails")
    .update({ sent_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("sent_at", null)
  if (error && TABLE_MISSING.test(error.message)) return
  if (error) throw new Error(error.message)
}

async function loadUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabaseServer.auth.admin.getUserById(userId)
  if (error) throw new Error(error.message)
  const email = data.user?.email?.trim()
  return email || null
}

async function sendProWelcomeEmail(to: string, kind: PaidProWelcomeKind, userId: string): Promise<boolean> {
  const message = buildPaidProWelcomeEmail(kind)
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": proWelcomeIdempotencyKey(userId),
    },
    body: JSON.stringify({
      from: PRO_WELCOME_FROM,
      to: [to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) console.warn("[billing] Resend respondió", res.status, "al email de bienvenida Pro")
  return res.ok
}
