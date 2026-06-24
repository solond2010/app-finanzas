"use client"

import { Suspense, useState, FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function LoginForm() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) })
      .then((res) => {
        if (res.ok) {
          router.push(searchParams.get("redirect") || "/dashboard")
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold text-center">Acceso restringido</h1>
      <p className="text-sm text-muted-foreground text-center">Introduce la contraseña para acceder</p>
      <input
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(false) }}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        placeholder="Contraseña"
        autoFocus
      />
      {error && <p className="text-sm text-destructive">Contraseña incorrecta</p>}
      <button type="submit" className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium">
        Entrar
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
