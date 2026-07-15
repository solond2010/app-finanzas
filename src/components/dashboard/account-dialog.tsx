"use client"

import { useEffect, useRef, useState } from "react"
import { type Account, generateId, useFinance } from "@/lib/store"
import { uploadLogo } from "@/lib/db-client"
import { formatMoney } from "@/lib/currency"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CURRENCY_OPTIONS, currencySymbol } from "@/lib/currency"
import { BANKS, matchBank } from "@/components/dashboard/account-logo"
import { useToast } from "@/components/ui/toast"
import { Upload, X, AlertCircle } from "lucide-react"
import { parseAmount } from "@/lib/validation"

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316"]

export function AccountDialog({
  account,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: {
  account?: Account
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (a: Account) => void
  onDelete?: (id: string) => void
}) {
  const [nombre, setNombre] = useState(account?.nombre ?? "")
  const [tipo, setTipo] = useState<Account["tipo"]>(account?.tipo ?? "efectivo")
  const [banco, setBanco] = useState(account?.banco ?? "")
  const [saldo, setSaldo] = useState(String(account?.saldo ?? 0))
  const [currency, setCurrency] = useState<Account["currency"]>(account?.currency ?? "EUR")
  const [objetivo, setObjetivo] = useState(String(account?.objetivo ?? ""))
  const [limiteMensual, setLimiteMensual] = useState(String(account?.limite_mensual ?? ""))
  const [color, setColor] = useState(account?.color ?? COLORS[0])
  const [logoUrl, setLogoUrl] = useState(account?.logoUrl ?? "")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { state } = useFinance()

  // Objetivo efectivo cuando el campo está vacío: la suma de las metas de
  // ahorro vinculadas a esta cuenta (accountGoal hace este mismo fallback al
  // pintar las tarjetas). Sin avisarlo aquí, la tarjeta dice "Objetivo:
  // 30.000 €" y este campo dice "Sin objetivo" — parece que se perdió.
  const inheritedGoal = account
    ? state.sinkingFunds.filter((f) => f.cuenta_id === account.id).reduce((s, f) => s + f.cantidad_objetivo, 0)
    : 0

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setNombre(account?.nombre ?? "")
      setTipo(account?.tipo ?? "efectivo")
      setBanco(account?.banco ?? "")
      setSaldo(String(account?.saldo ?? 0))
      setCurrency(account?.currency ?? "EUR")
      setObjetivo(String(account?.objetivo ?? ""))
      setLimiteMensual(String(account?.limite_mensual ?? ""))
      setColor(account?.color ?? COLORS[0])
      setLogoUrl(account?.logoUrl ?? "")
    })
  }, [account, open])

  const handleLogoFile = async (file: File) => {
    setUploading(true)
    try {
      const ext = file.name.split(".").pop() ?? "png"
      const path = `${account?.id ?? generateId()}-${Date.now()}.${ext}`
      const url = await uploadLogo(file, path)
      setLogoUrl(url)
    } catch {
      toast("No se pudo subir el logo. ¿Has creado el bucket \"bank-logos\" en Supabase?", "error")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!nombre.trim()) { setError("Ponle un nombre a la cuenta."); return }

    // El saldo sí admite negativos (cuenta en descubierto, tarjeta de crédito
    // con deuda), así que no puede pasar por parseAmountOrZero — solo se
    // rechaza si no es un número real.
    const rawSaldo = saldo.trim()
    const parsedSaldo = rawSaldo === "" ? 0 : Number(rawSaldo.replace(",", "."))
    if (!Number.isFinite(parsedSaldo)) { setError("El saldo no es un importe válido."); return }

    let parsedObjetivo: number | null = null
    if (objetivo.trim() !== "") {
      const n = parseAmount(objetivo)
      if (!n) { setError("El objetivo debe ser un importe mayor que 0 (o déjalo vacío)."); return }
      parsedObjetivo = n
    }

    let parsedLimite: number | null = null
    if (limiteMensual.trim() !== "") {
      const n = parseAmount(limiteMensual)
      if (!n) { setError("El límite mensual debe ser un importe mayor que 0 (o déjalo vacío)."); return }
      parsedLimite = n
    }

    onSave({
      id: account?.id ?? generateId(),
      nombre: nombre.trim(),
      tipo,
      banco,
      saldo: parsedSaldo,
      currency,
      objetivo: parsedObjetivo,
      limite_mensual: parsedLimite,
      color,
      logoUrl,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Editar Cuenta" : "Nueva Cuenta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Nombre</label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Emergencias" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Account["tipo"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emergencia">Emergencia</SelectItem>
                  <SelectItem value="ahorro">Ahorro</SelectItem>
                  <SelectItem value="inversion">Inversión</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="gastos">Gastos Mensuales</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Banco</label>
              <div className="flex flex-wrap gap-2">
                {BANKS.map((b) => {
                  const active = matchBank(banco)?.match === b.match
                  return (
                    <button
                      key={b.match}
                      type="button"
                      onClick={() => setBanco(b.name)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/banks/${b.file}`} alt={b.name} className="h-full w-full object-contain" />
                      </span>
                      {b.name}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setBanco("")}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${!matchBank(banco) ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                >
                  Otro
                </button>
              </div>
              {!matchBank(banco) && (
                <Input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Nombre del banco (opcional)" className="mt-2" />
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = "" }}
              />
              <div className="mt-2 flex items-center gap-3">
                {logoUrl ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-border/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Logo subido" className="h-full w-full object-contain" />
                  </span>
                ) : null}
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> {uploading ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo del banco"}
                </Button>
                {logoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl("")}>
                    <X className="h-3.5 w-3.5" /> Quitar
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Saldo ({currencySymbol(currency)})</label>
              <Input type="number" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Divisa</label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Account["currency"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="p-2">
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Objetivo ({currencySymbol(currency)})</label>
              <Input type="number" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder={inheritedGoal > 0 ? formatMoney(inheritedGoal, currency) : "Sin objetivo"} />
              {objetivo.trim() === "" && inheritedGoal > 0 && (
                <p className="text-[11px] leading-4 text-muted-foreground">
                  Heredado de sus metas de ahorro. Escribe un importe solo si quieres fijar uno propio.
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-7 w-7 sm:h-6 sm:w-6 rounded-full border-2 transition-all active:scale-90 touch-manipulation ${color === c ? "border-white scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          {tipo === "gastos" && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Límite mensual (€)</label>
              <Input type="number" value={limiteMensual} onChange={(e) => setLimiteMensual(e.target.value)} placeholder="Ej: 2000" />
            </div>
          )}
          {error && (
            <p className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            {onDelete && account && (
              <Button type="button" variant="destructive" size="sm" className="mr-auto" onClick={() => onDelete(account.id)}>
                Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" size="sm">{account ? "Guardar" : "Crear"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
