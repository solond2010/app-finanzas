"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Copy, KeyRound } from "@/components/icons"
import {
  formatMcpTokenDate,
  MCP_ENDPOINT_URL,
  MCP_OAUTH_CONNECTORS_PUBLIC,
  MCP_OAUTH_CONNECTOR_STEPS,
  type McpGrantItem,
  type McpTokenItem,
} from "@/lib/mcp/public"

type Me = { mode: "accounts" | "password"; userId: string; email: string | null }

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

export function McpConnectCardView({
  tokens,
  grants = [],
  tokensError,
  newToken,
  busy,
  connectorsPublic = MCP_OAUTH_CONNECTORS_PUBLIC,
  onGenerate,
  onDismissToken,
  onRevoke,
  onRevokeGrant,
  onCopy,
}: {
  tokens: McpTokenItem[]
  grants?: McpGrantItem[]
  tokensError?: string | null
  newToken?: string | null
  busy?: boolean
  connectorsPublic?: boolean
  onGenerate?: () => void
  onDismissToken?: () => void
  onRevoke?: (id: string) => void
  onRevokeGrant?: (id: string) => void
  onCopy?: (value: string, label: string) => void
}) {
  return (
    <Card id="mcp" className="scroll-mt-6 border border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <KeyRound className="h-4 w-4" />
          Conectar con ChatGPT/Claude
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-5 text-muted-foreground">
          Apunta gastos e ingresos desde un chat, y se verán en tu cuenta.
        </p>

        <div className="space-y-2 rounded-2xl bg-muted/30 p-3 ring-1 ring-border/20 sm:p-4">
          <p className="text-xs font-medium">URL del servidor</p>
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-xs leading-5">{MCP_ENDPOINT_URL}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 shrink-0"
              aria-label="Copiar URL del servidor"
              onClick={() => onCopy?.(MCP_ENDPOINT_URL, "URL copiada")}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            En clientes que aceptan un token personal (por ejemplo Cursor), añade esta cabecera:
          </p>
          <code className="block break-all font-mono text-xs leading-5">Authorization: Bearer TU_TOKEN</code>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/35 p-3 sm:p-4">
          <p className="text-sm font-medium">ChatGPT y Claude.ai</p>
          {connectorsPublic ? (
            <ol className="mt-2 space-y-3">
              {MCP_OAUTH_CONNECTOR_STEPS.map((step) => (
                <li key={step.title}>
                  <p className="text-xs font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Próximamente. Esos conectores necesitan un inicio de sesión OAuth, que todavía no está desplegado.
            </p>
          )}
        </div>

        {newToken ? (
          <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3">
            <p className="text-xs font-medium">Copia este token ahora: no se volverá a mostrar.</p>
            <div className="flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-xs leading-5">{newToken}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 shrink-0"
                aria-label="Copiar token"
                onClick={() => onCopy?.(newToken, "Token copiado")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button type="button" size="sm" variant="ghost" className="h-9 px-2" onClick={onDismissToken}>
              Ya lo he copiado
            </Button>
          </div>
        ) : null}

        <Button
          type="button"
          className="h-11 w-full rounded-xl sm:w-auto"
          disabled={busy}
          onClick={onGenerate}
        >
          <KeyRound className="mr-1.5 h-3.5 w-3.5" />
          Generar token
        </Button>

        {tokensError ? (
          <p className="text-xs text-destructive">{tokensError}</p>
        ) : tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aún no tienes tokens personales.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {tokens.map((token) => (
              <li key={token.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{token.name}</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Creado {formatMcpTokenDate(token.created_at)}
                    <span className="hidden sm:inline"> · </span>
                    <span className="block sm:inline">Último uso {formatMcpTokenDate(token.last_used_at)}</span>
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 shrink-0 self-start sm:self-center"
                  aria-label={`Revocar ${token.name}`}
                  onClick={() => onRevoke?.(token.id)}
                >
                  Revocar
                </Button>
              </li>
            ))}
          </ul>
        )}

        {grants.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Aplicaciones conectadas</p>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {grants.map((grant) => (
                <li key={grant.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{grant.name}</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Conectada {formatMcpTokenDate(grant.created_at)}
                      <span className="hidden sm:inline"> · </span>
                      <span className="block sm:inline">Último uso {formatMcpTokenDate(grant.last_used_at)}</span>
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 shrink-0 self-start sm:self-center"
                    aria-label={`Revocar ${grant.name}`}
                    onClick={() => onRevokeGrant?.(grant.id)}
                  >
                    Revocar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Tarjeta de Ajustes para generar y revocar tokens MCP y conexiones OAuth. */
export function McpConnectCard() {
  const { toast } = useToast()
  const [visible, setVisible] = useState(false)
  const [tokens, setTokens] = useState<McpTokenItem[]>([])
  const [grants, setGrants] = useState<McpGrantItem[]>([])
  const [tokensError, setTokensError] = useState<string | null>(null)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadTokens = useCallback(async () => {
    const [tokensRes, grantsRes] = await Promise.all([
      fetch("/api/mcp/tokens", { cache: "no-store" }),
      fetch("/api/mcp/grants", { cache: "no-store" }),
    ])
    const tokensBody = await tokensRes.json().catch(() => null)
    const grantsBody = await grantsRes.json().catch(() => null)
    if (!tokensRes.ok) {
      setTokensError(tokensBody?.error ?? "No se pudieron cargar los tokens")
      return
    }
    setTokensError(null)
    setTokens(tokensBody.tokens ?? [])
    setGrants(grantsRes.ok ? (grantsBody.grants ?? []) : [])
  }, [])

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null)
      const body = res?.ok ? ((await res.json().catch(() => null)) as Me | null) : null
      if (body?.mode !== "accounts") return
      setVisible(true)
      await loadTokens()
    })()
  }, [loadTokens])

  if (!visible) return null

  async function generateToken() {
    setBusy(true)
    try {
      const res = await fetch("/api/mcp/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      const body = await res.json().catch(() => null)
      if (!res.ok) { toast(body?.error ?? "No se pudo crear el token", "error"); return }
      setNewToken(typeof body.token === "string" ? body.token : null)
      await loadTokens()
    } finally {
      setBusy(false)
    }
  }

  async function revokeToken(id: string) {
    if (!window.confirm("¿Revocar este token? Los clientes que lo usen dejarán de poder apuntar movimientos.")) return
    const res = await fetch("/api/mcp/tokens", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    if (!res.ok) { toast("No se pudo revocar el token", "error"); return }
    toast("Token revocado", "success")
    if (newToken) setNewToken(null)
    await loadTokens()
  }

  async function revokeGrant(id: string) {
    if (!window.confirm("¿Revocar esta conexión? ChatGPT o Claude dejarán de poder apuntar movimientos hasta que vuelvas a autorizarlos.")) return
    const res = await fetch("/api/mcp/grants", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    if (!res.ok) { toast("No se pudo revocar la conexión", "error"); return }
    toast("Conexión revocada", "success")
    await loadTokens()
  }

  function handleCopy(value: string, label: string) {
    void copyText(value).then((ok) => toast(ok ? label : "No se pudo copiar", ok ? "success" : "error"))
  }

  return (
    <McpConnectCardView
      tokens={tokens}
      grants={grants}
      tokensError={tokensError}
      newToken={newToken}
      busy={busy}
      onGenerate={() => void generateToken()}
      onDismissToken={() => setNewToken(null)}
      onRevoke={(id) => void revokeToken(id)}
      onRevokeGrant={(id) => void revokeGrant(id)}
      onCopy={handleCopy}
    />
  )
}
