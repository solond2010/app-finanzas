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
import { BANKS, BankInitial, bankSlug, matchBank } from "@/components/dashboard/account-logo"
import { useToast } from "@/components/ui/toast"
import { Upload, X, AlertCircle, Check, Palette } from "@/components/icons"
import { parseAmount } from "@/lib/validation"
import { ACCOUNT_COLORS, accountColor, isHexColor, normalizeHex, readableOn } from "@/lib/account-colors"
import { INTEREST_FREQUENCIES, interestFrequencyLabel, type InterestFrequency } from "@/lib/remunerated-accounts"
import { localDateKey } from "@/lib/date-utils"

const COLORS = ACCOUNT_COLORS.map((c) => c.hex)

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
  const [interestTae, setInterestTae] = useState(account?.interest_tae == null ? "" : String(account.interest_tae))
  const [interestFrequency, setInterestFrequency] = useState<InterestFrequency>(account?.interest_frequency ?? "monthly")
  const [interestStartDate, setInterestStartDate] = useState(account?.interest_start_date ?? localDateKey())
  const [interestLastPaymentDate, setInterestLastPaymentDate] = useState(account?.interest_last_payment_date ?? "")
  const [interestBalanceCap, setInterestBalanceCap] = useState(account?.interest_balance_cap == null ? "" : String(account.interest_balance_cap))
  const [color, setColor] = useState(account ? accountColor(account) : COLORS[0])
  const [logoUrl, setLogoUrl] = useState(account?.logoUrl ?? "")
  const [bankQuery, setBankQuery] = useState("")
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
      setInterestTae(account?.interest_tae == null ? "" : String(account.interest_tae))
      setInterestFrequency(account?.interest_frequency ?? "monthly")
      setInterestStartDate(account?.interest_start_date ?? localDateKey())
      setInterestLastPaymentDate(account?.interest_last_payment_date ?? "")
      setInterestBalanceCap(account?.interest_balance_cap == null ? "" : String(account.interest_balance_cap))
      setColor(account ? accountColor(account) : COLORS[0])
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

    let parsedInterestTae: number | null = null
    if (tipo === "remunerada" && interestTae.trim() !== "") {
      const value = Number(interestTae.replace(",", "."))
      if (!Number.isFinite(value) || value < 0 || value > 100) { setError("La TAE debe estar entre 0 % y 100 %."); return }
      parsedInterestTae = value
    }

    let parsedInterestCap: number | null = null
    if (tipo === "remunerada" && interestBalanceCap.trim() !== "") {
      const value = parseAmount(interestBalanceCap)
      if (!value) { setError("El tope remunerado debe ser mayor que 0 (o déjalo vacío). "); return }
      parsedInterestCap = value
    }
    if (tipo === "remunerada" && parsedInterestTae !== null && !interestStartDate && !interestLastPaymentDate) {
      setError("Indica desde qué fecha debe calcularse la estimación.")
      return
    }

    const interestColumnsExist = account && (
      account.interest_tae !== undefined || account.interest_frequency !== undefined ||
      account.interest_start_date !== undefined || account.interest_last_payment_date !== undefined ||
      account.interest_balance_cap !== undefined
    )
    const interestSettings = (tipo === "remunerada" && parsedInterestTae !== null) || interestColumnsExist
      ? {
          interest_tae: tipo === "remunerada" ? parsedInterestTae : null,
          interest_frequency: tipo === "remunerada" ? interestFrequency : null,
          interest_start_date: tipo === "remunerada" ? (interestStartDate || null) : null,
          interest_last_payment_date: tipo === "remunerada" ? (interestLastPaymentDate || null) : null,
          interest_balance_cap: tipo === "remunerada" ? parsedInterestCap : null,
        }
      : {}

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
      ...interestSettings,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
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
                  <SelectItem value="remunerada">Cuenta remunerada</SelectItem>
                  <SelectItem value="deposito">Depósito a plazo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Banco</label>
              <Input value={bankQuery} onChange={(e) => setBankQuery(e.target.value)} placeholder="Buscar banco o bróker…" aria-label="Buscar banco" className="mb-2" />
              <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                {BANKS.filter((b) => !bankQuery.trim() || bankSlug(b.name).includes(bankSlug(bankQuery))).map((b) => {
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
                        <img src={`/banks/${b.file}`} alt="" loading="lazy" className="h-full w-full object-contain" />
                      </span>
                      {b.name}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => { setBanco(matchBank(bankQuery) ? "" : bankQuery.trim()); }}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${!matchBank(banco) ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                >
                  {!matchBank(banco) && banco.trim() && <BankInitial name={banco} className="h-5 w-5 rounded text-[11px]" />}
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
                <SelectContent className="max-h-[min(60svh,320px)] p-2">
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
              {objetivo.trim() === "" && inheritedGoal > 0 ? (
                <p className="text-[11px] leading-4 text-muted-foreground">
                  Heredado de sus metas de ahorro. Escribe un importe solo si quieres fijar uno propio.
                </p>
              ) : (
                <p className="text-[11px] leading-4 text-muted-foreground">Cuánto quieres llegar a tener en esta cuenta. Verás tu progreso en la cuenta y en Analíticas.</p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-muted-foreground">Color</label>
                <span className="text-[11px] text-muted-foreground">{ACCOUNT_COLORS.find((c) => c.hex === normalizeHex(color))?.name ?? "Personalizado"}</span>
              </div>
              <div role="radiogroup" aria-label="Color de la cuenta" className="grid grid-cols-9 gap-1.5 sm:gap-2">
                {ACCOUNT_COLORS.map((c) => {
                  const active = normalizeHex(color) === c.hex
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={c.name}
                      title={c.name}
                      className={`flex aspect-square w-full max-w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform active:scale-90 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "ring-2 ring-foreground" : "ring-1 ring-black/10 dark:ring-white/10"}`}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => setColor(c.hex)}
                    >
                      {active && <Check className="size-3.5" style={{ color: readableOn(c.hex) }} />}
                    </button>
                  )
                })}
                {(() => {
                  const custom = !COLORS.includes(normalizeHex(color))
                  return (
                    <label
                      title="Elegir otro color"
                      className={`relative flex aspect-square w-full max-w-9 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform active:scale-90 focus-within:ring-2 focus-within:ring-primary ${custom ? "ring-2 ring-foreground" : "ring-1 ring-border"}`}
                      style={custom ? { backgroundColor: color } : { background: "conic-gradient(#FF6B5B, #FACC15, #2BD9A0, #38BDF8, #8B5CF6, #F06292, #FF6B5B)" }}
                    >
                      <span className="flex size-[62%] items-center justify-center rounded-full bg-card/90">
                        <Palette className="size-3.5 text-foreground" />
                      </span>
                      <input
                        type="color"
                        aria-label="Elegir otro color"
                        value={isHexColor(color) ? color.toLowerCase() : "#f5a524"}
                        onChange={(e) => setColor(normalizeHex(e.target.value))}
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                      />
                    </label>
                  )
                })()}
              </div>
              <p className="text-[11px] leading-4 text-muted-foreground">Se usa en Cuentas, en los gráficos y en tus movimientos para reconocerla de un vistazo.</p>
            </div>
          </div>
          {tipo === "gastos" && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Límite mensual (€)</label>
              <Input type="number" value={limiteMensual} onChange={(e) => setLimiteMensual(e.target.value)} placeholder="Ej: 2000" />
              <p className="text-[11px] leading-4 text-muted-foreground">Tope de gasto al mes para esta cuenta. Te avisamos al llegar al 80 % y si lo pasas.</p>
            </div>
          )}
          {tipo === "remunerada" && (
            <section className="space-y-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.035] p-4 sm:col-span-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Intereses de la cuenta</h3>
                  <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-300">Opcional</span>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">Consulta una estimación según tu saldo y las condiciones del banco. No cambia el saldo ni registra ingresos automáticamente.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="account-interest-tae" className="text-xs text-muted-foreground">TAE anual (%)</label>
                  <Input id="account-interest-tae" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={interestTae} onChange={(e) => setInterestTae(e.target.value)} placeholder="Ej.: 2,50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Frecuencia del abono</label>
                  <Select value={interestFrequency} onValueChange={(value) => setInterestFrequency(value as InterestFrequency)}>
                    <SelectTrigger><SelectValue>{(value) => interestFrequencyLabel(value)}</SelectValue></SelectTrigger>
                    <SelectContent>{INTEREST_FREQUENCIES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="account-interest-start" className="text-xs text-muted-foreground">Calcular desde</label>
                  <Input id="account-interest-start" type="date" value={interestStartDate} onChange={(e) => setInterestStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="account-interest-last-payment" className="text-xs text-muted-foreground">Último abono de intereses</label>
                  <Input id="account-interest-last-payment" type="date" value={interestLastPaymentDate} onChange={(e) => setInterestLastPaymentDate(e.target.value)} />
                  <p className="text-[11px] leading-4 text-muted-foreground">Actualízalo cuando registres un abono real. Déjalo vacío si aún no te han pagado.</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="account-interest-cap" className="text-xs text-muted-foreground">Saldo máximo remunerado ({currencySymbol(currency)})</label>
                  <Input id="account-interest-cap" type="number" min="0" step="0.01" inputMode="decimal" value={interestBalanceCap} onChange={(e) => setInterestBalanceCap(e.target.value)} placeholder="Sin límite" />
                  <p className="text-[11px] leading-4 text-muted-foreground">Opcional. Si el banco remunera todo el saldo, déjalo vacío.</p>
                </div>
              </div>
            </section>
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
