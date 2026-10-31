"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, Landmark, Receipt, Smartphone, Sparkles, X } from "@/components/icons"
import { openMovementDialog } from "@/components/layout/quick-actions"
import { useFinance } from "@/lib/store"
import { useMe } from "@/lib/use-me"
import { getSetting, setSetting } from "@/lib/settings"
import { hasOwnAccount, ONBOARDING_SETTING_KEY, parseOnboardingStatus, shouldShowOnboarding, type OnboardingStatus } from "@/lib/onboarding"
import { cn } from "@/lib/utils"

const localKey = (userId: string) => `garra-onboarding:${userId}`
const shortcutKey = (userId: string) => `garra-onboarding-atajo:${userId}`

/** Guía de bienvenida de 3 pasos para cuentas nuevas (no se muestra a Moha). */
export function OnboardingGuide() {
  const { state, loading } = useFinance()
  const { me, loaded } = useMe()
  const [status, setStatus] = useState<OnboardingStatus | null | undefined>(undefined)
  const [hasToken, setHasToken] = useState(false)

  const userId = me?.userId ?? null

  // Estado guardado: primero el del dispositivo (instantáneo), luego la nube.
  useEffect(() => {
    if (!userId || me?.isAdmin) return
    let alive = true
    let local: OnboardingStatus | null = null
    try { local = parseOnboardingStatus(localStorage.getItem(localKey(userId))) } catch { /* sin almacenamiento local */ }
    try { if (localStorage.getItem(shortcutKey(userId)) === "1") queueMicrotask(() => alive && setHasToken(true)) } catch { /* idem */ }
    if (local === "dismissed" || local === "done") { queueMicrotask(() => alive && setStatus(local)); return () => { alive = false } }
    void getSetting(ONBOARDING_SETTING_KEY).then((remote) => {
      if (!alive) return
      const parsed = parseOnboardingStatus(remote ?? null) ?? local
      setStatus(parsed)
    })
    void fetch("/api/tokens", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => { if (alive && Array.isArray(body?.tokens) && body.tokens.length > 0) setHasToken(true) })
      .catch(() => {})
    return () => { alive = false }
  }, [userId, me?.isAdmin])

  const save = (next: OnboardingStatus) => {
    setStatus(next)
    if (!userId) return
    try { localStorage.setItem(localKey(userId), next) } catch { /* se guarda igualmente en la nube */ }
    void setSetting(ONBOARDING_SETTING_KEY, next)
  }

  const visible = !loading && loaded && Boolean(userId) && status !== undefined &&
    shouldShowOnboarding({ isAdmin: Boolean(me?.isAdmin), status: status ?? null, transactionCount: state.transactions.length })

  // La primera vez que se enseña, se marca como empezada: así no desaparece
  // de golpe al apuntar el primer movimiento.
  useEffect(() => {
    if (visible && status === null) queueMicrotask(() => save("started"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, status])

  if (!visible) return null

  const steps = [
    {
      done: hasOwnAccount(state.accounts),
      icon: Landmark,
      title: "Crea tu cuenta",
      text: "Tu banco, tu tarjeta o el efectivo, con el saldo que tiene hoy.",
      action: <Link href="/cuentas#nueva" className={stepButton}>Crear cuenta<ArrowRight className="size-3.5" /></Link>,
    },
    {
      done: state.transactions.length > 0,
      icon: Receipt,
      title: "Apunta tu primer movimiento",
      text: "Un gasto o un ingreso. Se tarda menos de diez segundos.",
      action: <button type="button" onClick={() => openMovementDialog()} className={stepButton}>Apuntar movimiento<ArrowRight className="size-3.5" /></button>,
    },
    {
      done: hasToken,
      icon: Smartphone,
      title: "Instala el atajo del iPhone",
      text: "Apunta gastos desde la pantalla de inicio sin abrir Garra.",
      action: (
        <Link href="/configuracion#atajos" onClick={() => { try { if (userId) localStorage.setItem(shortcutKey(userId), "1") } catch { /* opcional */ } }} className={stepButton}>
          Ver cómo<ArrowRight className="size-3.5" />
        </Link>
      ),
    },
  ]
  const completed = steps.filter((s) => s.done).length
  const allDone = completed === steps.length
  const nextIndex = steps.findIndex((s) => !s.done)

  return (
    <section aria-labelledby="onboarding-title" className="relative overflow-hidden rounded-[22px] border border-[color-mix(in_oklch,var(--gold),transparent_60%)] bg-card p-4 shadow-sm sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[var(--gold)] opacity-[0.07] blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--gold),transparent_85%)]">
            <Sparkles className="size-5 text-[var(--gold)]" />
          </span>
          <div className="min-w-0">
            <p className="page-section-label">Bienvenida</p>
            <h2 id="onboarding-title" className="mt-0.5 text-lg font-semibold leading-tight text-foreground sm:text-xl">
              {allDone ? "¡Todo listo! Ya sacas partido a Garra" : "Empieza con Garra en 3 pasos"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{allDone ? "Puedes cerrar esta guía cuando quieras." : `${completed} de 3 hechos · unos 2 minutos en total`}</p>
          </div>
        </div>
        <button type="button" onClick={() => save(allDone ? "done" : "dismissed")} aria-label="Cerrar la guía" title="Cerrar la guía" className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95">
          <X className="size-4" />
        </button>
      </div>

      <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-500" style={{ width: `${(completed / 3) * 100}%` }} />
      </div>

      <ol className="relative mt-4 grid gap-2.5 md:grid-cols-3 md:gap-3">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isNext = index === nextIndex
          return (
            <li
              key={step.title}
              className={cn(
                "flex gap-3 rounded-2xl border p-3.5 transition-colors md:flex-col md:p-4",
                step.done ? "border-emerald-500/25 bg-emerald-500/[0.06]" : isNext ? "border-[color-mix(in_oklch,var(--gold),transparent_55%)] bg-background/50" : "border-border bg-background/30",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", step.done ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>
                {step.done ? <Check className="size-4" /> : <Icon className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paso {index + 1}</p>
                <p className={cn("text-sm font-semibold text-foreground", step.done && "text-muted-foreground line-through decoration-emerald-500/60")}>{step.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.text}</p>
                {!step.done && <div className="mt-2.5">{step.action}</div>}
              </div>
            </li>
          )
        })}
      </ol>

      {!allDone && (
        <div className="relative mt-3 flex justify-end">
          <button type="button" onClick={() => save("dismissed")} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Ya sé usarla, ocultar guía
          </button>
        </div>
      )}
    </section>
  )
}

const stepButton = "inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
