"use client"

import { Suspense, useState, FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold text-center">Acceso restringido</h1>
      <p className="text-sm text-muted-foreground text-center">Introduce la contraseña para acceder</p>
      <input
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(false); setErrorMsg("") }}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        placeholder="Contraseña"
        autoFocus
        disabled={loading}
      />
      {error && <p className="text-sm text-destructive">{errorMsg}</p>}
      <button
        type="submit"
        disabled={loading || !password}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
