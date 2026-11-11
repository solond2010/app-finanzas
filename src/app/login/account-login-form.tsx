"use client"

import { useState, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "@/components/icons"
import { GarraLogo } from "@/components/brand/garra-logo"
import { loginNotice } from "@/lib/auth-links"
import { PasswordInput } from "@/components/ui/password-input"
import { DemoEntryButton } from "@/components/demo/demo-entry-button"
import { safeNextPath } from "@/lib/auth-redirect"

type Mode = "login" | "signup" | "magic" | "recovery"

const inputClass =
  "flex h-12 w-full rounded-xl border border-input bg-background/60 px-4 text-sm ring-1 ring-border/25 transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"

const TITLES: Record<Mode, { title: string; subtitle: string; button: string }> = {
  login: { title: "Entra en tu cuenta", subtitle: "Con tu email y tu contraseña.", button: "Entrar" },
  signup: { title: "Crea tu cuenta", subtitle: "Gratis. Solo tú verás tus datos.", button: "Crear cuenta" },
  magic: { title: "Entrar sin contraseña", subtitle: "Te enviamos un enlace a tu email para entrar.", button: "Enviar enlace" },
  recovery: { title: "Recupera tu acceso", subtitle: "Te enviamos un enlace para elegir una contraseña nueva.", button: "Enviar enlace" },
}

export function AccountLoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>(searchParams.get("modo") === "registro" ? "signup" : "login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const notice = loginNotice(searchParams)
  const [error, setError] = useState(notice?.kind === "error" ? notice.text : "")
  const [info, setInfo] = useState(notice?.kind === "info" ? notice.text : "")

  function switchMode(next: Mode) {
    setMode(next)
    setError("")
    setInfo("")
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setInfo("")
    const endpoint = mode === "login" ? "/api/auth/login" : mode === "signup" ? "/api/auth/signup" : mode === "recovery" ? "/api/auth/recovery" : "/api/auth/magic-link"
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "magic" || mode === "recovery" ? { email } : { email, password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error ?? "No se pudo completar. Inténtalo de nuevo.")
        return
      }
      if (mode === "magic" || mode === "recovery") {
        setInfo(mode === "recovery"
          ? "Si hay una cuenta con ese email, te llegará un enlace para elegir una contraseña nueva. Revisa también el spam."
          : "Si hay una cuenta con ese email, te llegará un enlace en unos segundos. Revisa también el spam.")
        return
      }
      if (mode === "signup" && body?.needsConfirmation) {
        setInfo("¡Cuenta creada! Te hemos enviado un email: pulsa el enlace para activarla.")
        return
      }
      const redirect = searchParams.get("redirect") || "/dashboard"
      // Navegación completa: así la app arranca de cero con el nuevo usuario.
      window.location.href = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/dashboard"
    } catch {
      setError("Error de conexión. Verifica tu red e inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const t = TITLES[mode]
  const canSubmit = email.includes("@") && (mode === "magic" || mode === "recovery" || password.length >= (mode === "signup" ? 8 : 1))

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex items-center justify-center gap-2.5">
        <GarraLogo tagline />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {googleEnabled && (
        <>
          <form method="post" action="/api/auth/google">
            <input type="hidden" name="next" value={safeNextPath(searchParams.get("redirect"))} />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-background/80 px-3 text-sm font-semibold transition-all hover:bg-muted/60 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GoogleMark />
              Continuar con Google
            </button>
          </form>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            o con tu email
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="Email"
          autoFocus
          disabled={loading}
          required
        />
        {mode !== "magic" && mode !== "recovery" && (
          <PasswordInput
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder={mode === "signup" ? "Contraseña (mínimo 8 caracteres)" : "Contraseña"}
            disabled={loading}
            required
          />
        )}
        {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
        {info && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400" role="status">{info}</p>}
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.button}
        </button>
        {mode === "signup" && (
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Al crear tu cuenta aceptas las <a href="/terminos" className="font-medium text-foreground underline underline-offset-2">Condiciones de uso</a> y la <a href="/privacidad" className="font-medium text-foreground underline underline-offset-2">Política de privacidad</a>.
          </p>
        )}
      </form>
      {/* Primera visita: crear cuenta y ver la demo al mismo nivel. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {mode === "signup" ? "¿Prefieres verla antes?" : "¿Primera vez en Garra?"}
          <span className="h-px flex-1 bg-border" />
        </div>
        <DemoEntryButton label={mode === "signup" ? "Ver la demo antes" : "Ver la demo"} />
        {mode !== "signup" && (
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-border bg-background/60 px-3 text-sm font-semibold transition-all hover:bg-muted/60 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Crear cuenta gratis
          </button>
        )}
      </div>
      <div className="flex flex-col items-center gap-2 text-sm">
        {mode !== "login" && <button type="button" className="text-primary hover:underline" onClick={() => switchMode("login")}>Ya tengo cuenta: entrar</button>}
        {mode !== "recovery" && <button type="button" className="text-muted-foreground hover:underline" onClick={() => switchMode("recovery")}>¿Olvidaste la contraseña?</button>}
        {mode !== "magic" && <button type="button" className="text-muted-foreground hover:underline" onClick={() => switchMode("magic")}>Entrar sin contraseña (enlace por email)</button>}
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 0 1 5.48 12c0-.72.12-1.43.36-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
    </svg>
  )
}

