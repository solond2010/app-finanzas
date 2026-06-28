"use client"

import { Suspense, useState, FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Wallet } from "lucide-react"

function LoginForm() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError(false)
    setErrorMsg("")
    fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) })
      .then((res) => {
        if (res.ok) {
          const redirect = searchParams.get("redirect") || "/dashboard"
          if (redirect.startsWith("/")) {
            router.push(redirect)
          } else {
            router.push("/dashboard")
          }
        } else {
          setError(true)
          setErrorMsg("Contraseña incorrecta")
        }
      })
      .catch(() => {
        setError(true)
        setErrorMsg("Error de conexión. Verifica tu red e inténtalo de nuevo.")
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="space-y-2 text-center">
        <div className="mx-auto mb-4 inline-flex rounded-2xl bg-background/60 p-3 ring-1 ring-border/15">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Acceso restringido</h1>
        <p className="text-sm text-muted-foreground">Introduce la contraseña para acceder a tu panel financiero.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); setErrorMsg("") }}
          className="flex h-12 w-full rounded-xl border border-input bg-background/60 px-4 text-sm ring-1 ring-border/25 transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          placeholder="Contraseña"
          autoFocus
          disabled={loading}
        />
        {error && <p className="text-sm text-destructive font-medium">{errorMsg}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-medium text-sm text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(139,92,246,0.10),transparent_35%)] dark:bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.20),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(139,92,246,0.18),transparent_35%)]" />
      <div className="relative z-10 w-full max-w-sm rounded-[32px] bg-card/70 p-8 shadow-2xl ring-1 ring-border/25 backdrop-blur-xl card-glow">
        <Suspense fallback={<div className="text-sm text-muted-foreground text-center py-8">Cargando...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
