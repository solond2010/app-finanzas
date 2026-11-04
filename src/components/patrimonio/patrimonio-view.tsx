"use client"

import { useMemo, useState, type FormEvent } from "react"
import { useFinance } from "@/lib/store"
import { convertToEur } from "@/lib/currency"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { Sensitive } from "@/components/shared/sensitive"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { useAssetsDebts } from "@/lib/use-assets-debts"
import { ASSET_LABEL, ASSET_TYPES, DEBT_LABEL, DEBT_TYPES, paidPct, totals, type Asset, type AssetType, type Debt, type DebtType } from "@/lib/assets-debts"
import { CarProfile, CreditCard, Diamond, HandCoins, House, Landmark, Package, PaintBrush, PencilLine, Plus, Scales, Trash2, Watch } from "@/components/icons"

type IconC = typeof House
const ASSET_ICON: Record<AssetType, IconC> = { vivienda: House, coche: CarProfile, relojes: Watch, joyas: Diamond, arte: PaintBrush, otro: Package }
const DEBT_ICON: Record<DebtType, IconC> = { hipoteca: House, prestamo_coche: CarProfile, personal: HandCoins, tarjeta: CreditCard, otra: Package }
const eur = (v: number) => formatMoney(v, "EUR")
const CARD = "min-w-0 rounded-2xl border border-border/80 bg-card p-4 sm:p-6"
const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const toNum = (s: string) => { const n = Number(s.replace(/\./g, "").replace(",", ".")); return s.trim() === "" ? null : Number.isFinite(n) ? n : NaN }
const show = (v: number | null) => (v === null ? "" : String(v).replace(".", ","))

function TypeChips<T extends string>({ types, labels, icons, value, onChange }: { types: readonly T[]; labels: Record<T, string>; icons: Record<T, IconC>; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo">
      {types.map((t) => {
        const I: IconC = icons[t]
        return (
          <button key={t} type="button" role="radio" aria-checked={value === t} onClick={() => onChange(t)} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors", value === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            <I className="size-4" />{labels[t]}
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-1"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>
}

function AssetForm({ initial, onSave, onCancel }: { initial: Asset | null; onSave: (a: Asset) => Promise<void>; onCancel: () => void }) {
  const [tipo, setTipo] = useState<AssetType>(initial?.tipo ?? "vivienda")
  const [nombre, setNombre] = useState(initial?.nombre ?? "")
  const [valor, setValor] = useState(initial ? show(initial.valor) : "")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const v = toNum(valor)
    if (!nombre.trim()) return setErr("Ponle un nombre.")
    if (v === null || Number.isNaN(v) || v < 0) return setErr("Introduce un valor válido.")
    setBusy(true)
    try { await onSave({ id: initial?.id ?? newId("asset"), nombre: nombre.trim(), tipo, valor: v, valor_fecha: new Date().toISOString().slice(0, 10), notas: initial?.notas ?? null }) } catch { setErr("No se pudo guardar. Inténtalo de nuevo.") } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="mt-3 min-w-0 space-y-3 rounded-xl border border-border bg-background/40 p-3 sm:p-4">
      <TypeChips types={ASSET_TYPES} labels={ASSET_LABEL} icons={ASSET_ICON} value={tipo} onChange={setTipo} />
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre"><Input value={nombre} onChange={(e) => { setNombre(e.target.value); setErr("") }} placeholder="Ej. Piso en Valencia" autoFocus /></Field>
        <Field label="Valor actual (€)"><Input value={valor} onChange={(e) => { setValor(e.target.value); setErr("") }} inputMode="decimal" placeholder="Ej. 240000" className="tabular-nums" /></Field>
      </div>
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button><Button type="submit" size="sm" disabled={busy}>Guardar</Button></div>
    </form>
  )
}

function DebtForm({ initial, assets, accounts, onSave, onCancel }: { initial: Debt | null; assets: Asset[]; accounts: { id: string; nombre: string; tipo: string }[]; onSave: (d: Debt) => Promise<void>; onCancel: () => void }) {
  const [tipo, setTipo] = useState<DebtType>(initial?.tipo ?? "hipoteca")
  const [nombre, setNombre] = useState(initial?.nombre ?? "")
  const [pendiente, setPendiente] = useState(initial ? show(initial.pendiente) : "")
  const [inicial, setInicial] = useState(show(initial?.principal_inicial ?? null))
  const [cuota, setCuota] = useState(show(initial?.cuota_mensual ?? null))
  const [tin, setTin] = useState(show(initial?.tin ?? null))
  const [assetId, setAssetId] = useState(initial?.asset_id ?? "")
  const [fijo, setFijo] = useState(initial?.cuota_gasto_fijo ?? false)
  const [dia, setDia] = useState(String(initial?.cuota_dia ?? 1))
  const [cuentaId, setCuentaId] = useState(initial?.cuota_cuenta_id ?? (accounts.find((a) => a.tipo === "gastos") ?? accounts[0])?.id ?? "")
  const cuotaNum = toNum(cuota)
  const canFijo = cuotaNum !== null && !Number.isNaN(cuotaNum) && cuotaNum > 0
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const p = toNum(pendiente), i = toNum(inicial), c = toNum(cuota), t = toNum(tin)
    if (!nombre.trim()) return setErr("Ponle un nombre.")
    if (p === null || Number.isNaN(p) || p < 0) return setErr("Introduce el importe pendiente.")
    if ([i, c, t].some((x) => x !== null && (Number.isNaN(x) || x < 0)) || (t !== null && t > 100)) return setErr("Revisa los campos opcionales.")
    const useFijo = fijo && canFijo
    if (useFijo && !cuentaId) return setErr("Elige la cuenta desde la que pagas la cuota.")
    const d = Math.round(Number(dia))
    setBusy(true)
    try { await onSave({ id: initial?.id ?? newId("debt"), nombre: nombre.trim(), tipo, pendiente: p, principal_inicial: i, cuota_mensual: c, tin: t, fecha_fin: initial?.fecha_fin ?? null, asset_id: assetId || null, notas: initial?.notas ?? null, cuota_gasto_fijo: useFijo, cuota_dia: useFijo ? Math.min(31, Math.max(1, d || 1)) : initial?.cuota_dia ?? null, cuota_cuenta_id: useFijo ? cuentaId : initial?.cuota_cuenta_id ?? null, pendiente_at: initial?.pendiente_at ?? null }) } catch { setErr("No se pudo guardar. Inténtalo de nuevo.") } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="mt-3 min-w-0 space-y-3 rounded-xl border border-border bg-background/40 p-3 sm:p-4">
      <TypeChips types={DEBT_TYPES} labels={DEBT_LABEL} icons={DEBT_ICON} value={tipo} onChange={setTipo} />
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre"><Input value={nombre} onChange={(e) => { setNombre(e.target.value); setErr("") }} placeholder="Ej. Hipoteca del piso" autoFocus /></Field>
        <Field label="Pendiente (€)"><Input value={pendiente} onChange={(e) => { setPendiente(e.target.value); setErr("") }} inputMode="decimal" placeholder="Ej. 150000" className="tabular-nums" /></Field>
        <Field label="Importe inicial (opcional)"><Input value={inicial} onChange={(e) => setInicial(e.target.value)} inputMode="decimal" placeholder="Para ver el % pagado" className="tabular-nums" /></Field>
        <Field label="Cuota mensual (opcional)"><Input value={cuota} onChange={(e) => setCuota(e.target.value)} inputMode="decimal" placeholder="Ej. 760" className="tabular-nums" /></Field>
        <Field label="Interés TIN % (opcional)"><Input value={tin} onChange={(e) => setTin(e.target.value)} inputMode="decimal" placeholder="Ej. 2,1" className="tabular-nums" /></Field>
        <Field label="Vinculada a un bien (opcional)">
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
            <option value="">Ninguno</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </Field>
      </div>
      {canFijo && (
        <div className="space-y-3 rounded-lg border border-border/70 p-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" checked={fijo} onChange={(e) => setFijo(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
            <span><span className="font-medium">Añadir la cuota a Gastos fijos</span><span className="block text-xs text-muted-foreground">Aparecerá cada mes en tu agenda para registrarla; no se crea ningún movimiento ahora.</span></span>
          </label>
          {fijo && (
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
              <Field label="Día del mes">
                <select value={dia} onChange={(e) => setDia(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {Array.from({ length: 31 }, (_, k) => <option key={k + 1} value={k + 1}>{k + 1}</option>)}
                </select>
              </Field>
              <Field label="Se paga desde">
                <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {accounts.length === 0 && <option value="">Crea primero una cuenta</option>}
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
      )}
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button><Button type="submit" size="sm" disabled={busy}>Guardar</Button></div>
    </form>
  )
}

function RowActions({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 gap-0.5">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${label}`} onClick={onEdit}><PencilLine /></Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Borrar ${label}`} onClick={onDelete}><Trash2 /></Button>
    </div>
  )
}

export function PatrimonioView() {
  const { state } = useFinance()
  const { toast } = useToast()
  const { assets, debts, loaded, saveAsset, deleteAsset, saveDebt, deleteDebt } = useAssetsDebts()
  const [assetEdit, setAssetEdit] = useState<Asset | "new" | null>(null)
  const [debtEdit, setDebtEdit] = useState<Debt | "new" | null>(null)

  const cuentas = useMemo(() => state.accounts.filter((a) => a.tipo !== "inversion").reduce((s, a) => s + convertToEur(a.saldo, a.currency), 0), [state.accounts])
  const inversiones = useMemo(() => state.accounts.filter((a) => a.tipo === "inversion").reduce((s, a) => s + convertToEur(a.saldo, a.currency), 0), [state.accounts])
  const t = totals(assets, debts)
  const vivienda = assets.filter((a) => a.tipo === "vivienda").reduce((s, a) => s + a.valor, 0)
  const otros = t.bienes - vivienda
  const activos = cuentas + inversiones + t.bienes
  const neto = activos - t.deudas
  const segs = [
    { k: "Cuentas", v: cuentas, c: "var(--accent-blue)" },
    { k: "Inversiones", v: inversiones, c: "var(--accent-violet)" },
    { k: "Vivienda", v: vivienda, c: "var(--gold)" },
    { k: "Otros bienes", v: otros, c: "color-mix(in oklch, var(--gold), white 35%)" },
  ]
  const segTotal = segs.reduce((s, x) => s + Math.max(0, x.v), 0) || 1

  const wrap = async (fn: () => Promise<void>, ok: string) => { try { await fn(); toast(ok, "success") } catch { toast("No se pudo guardar. Inténtalo de nuevo.", "error"); throw new Error("save") } }
  const askDelete = async (label: string, fn: () => Promise<void>, extra = "") => { if (window.confirm(`¿Borrar «${label}»?${extra}`)) await wrap(fn, "Borrado.").catch(() => {}) }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Patrimonio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tus cuentas, inversiones, bienes y deudas en una sola cifra.</p>
      </header>

      <section aria-label="Patrimonio neto" className="hero-panel grid gap-5 overflow-hidden rounded-[22px] border border-[color-mix(in_oklch,var(--gold),transparent_70%)] p-5 sm:p-7 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0">
          <p className="page-section-label">Patrimonio neto</p>
          <p className={cn("mt-2 text-[2.4rem] font-bold leading-none tracking-tight tabular-nums sm:text-6xl", neto < 0 && "text-red-500")}><Sensitive>{eur(neto)}</Sensitive></p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>Activos <Sensitive as="strong" className="font-bold text-emerald-500">{eur(activos)}</Sensitive></span>
            <span aria-hidden>−</span>
            <span>Deudas <Sensitive as="strong" className="font-bold text-red-500">{eur(t.deudas)}</Sensitive></span>
          </div>
          {t.cuotas > 0 && <p className="mt-1 text-xs text-muted-foreground">Pagas <Sensitive>{eur(t.cuotas)}</Sensitive> al mes en cuotas.</p>}
        </div>
        <div className="min-w-0">
          <p className="page-section-label mb-2">De qué está hecho</p>
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
            {segs.filter((s) => s.v > 0).map((s) => <span key={s.k} className="h-full min-w-[3px]" style={{ width: `${(s.v / segTotal) * 100}%`, backgroundColor: s.c }} title={s.k} />)}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {segs.map((s) => (
              <div key={s.k} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.c }} />{s.k}</span>
                <Sensitive className="shrink-0 font-semibold tabular-nums">{eur(s.v)}</Sensitive>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Cuentas e inversiones salen de tus cuentas; bienes y deudas los apuntas aquí.</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={CARD} aria-label="Otros bienes">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold"><House className="size-5 text-primary" />Otros bienes</h2>
            {assetEdit === null && <Button size="sm" onClick={() => setAssetEdit("new")}><Plus />Añadir bien</Button>}
          </div>
          {assetEdit === "new" && <AssetForm initial={null} onCancel={() => setAssetEdit(null)} onSave={(a) => wrap(() => saveAsset(a), "Bien guardado.").then(() => setAssetEdit(null))} />}
          {loaded && assets.length === 0 && assetEdit === null && <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Apunta tu vivienda, el coche o cualquier cosa de valor para verla en tu patrimonio.</p>}
          <ul className="mt-2 divide-y divide-border/70">
            {assets.map((a) => {
              const I = ASSET_ICON[a.tipo]
              return (
                <li key={a.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><I className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.nombre}</p>
                      <Sensitive as="p" className="text-sm font-bold tabular-nums sm:hidden">{eur(a.valor)}</Sensitive>
                      <p className="truncate text-xs text-muted-foreground">{ASSET_LABEL[a.tipo]}{a.valor_fecha ? ` · valor de ${new Date(a.valor_fecha).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}` : ""}</p>
                    </div>
                    <Sensitive className="hidden shrink-0 text-sm font-bold tabular-nums sm:inline">{eur(a.valor)}</Sensitive>
                    <RowActions label={a.nombre} onEdit={() => setAssetEdit(a)} onDelete={() => askDelete(a.nombre, () => deleteAsset(a.id))} />
                  </div>
                  {assetEdit !== null && assetEdit !== "new" && assetEdit.id === a.id && <AssetForm initial={a} onCancel={() => setAssetEdit(null)} onSave={(x) => wrap(() => saveAsset(x), "Bien guardado.").then(() => setAssetEdit(null))} />}
                </li>
              )
            })}
          </ul>
          {assets.length > 0 && <div className="mt-2 flex justify-between border-t border-dashed border-border pt-3 text-sm"><span className="text-muted-foreground">Total bienes</span><Sensitive className="font-bold tabular-nums text-emerald-500">{eur(t.bienes)}</Sensitive></div>}
        </section>

        <section className={CARD} aria-label="Deudas">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Landmark className="size-5 text-red-500" />Deudas</h2>
            {debtEdit === null && <Button size="sm" onClick={() => setDebtEdit("new")}><Plus />Añadir deuda</Button>}
          </div>
          {debtEdit === "new" && <DebtForm initial={null} assets={assets} accounts={state.accounts} onCancel={() => setDebtEdit(null)} onSave={(d) => wrap(() => saveDebt(d), d.cuota_gasto_fijo ? "Deuda guardada; la cuota ya está en Gastos fijos." : "Deuda guardada.").then(() => setDebtEdit(null))} />}
          {loaded && debts.length === 0 && debtEdit === null && <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Hipoteca, préstamos o tarjetas: apunta lo que te queda por pagar y se restará de tu patrimonio.</p>}
          <ul className="mt-2 divide-y divide-border/70">
            {debts.map((d) => {
              const I = DEBT_ICON[d.tipo]
              const pct = paidPct(d)
              const linked = assets.find((a) => a.id === d.asset_id)
              const meta = [DEBT_LABEL[d.tipo], d.cuota_gasto_fijo && d.cuota_mensual ? `gasto fijo día ${d.cuota_dia ?? 1}` : null, d.cuota_mensual ? `${eur(d.cuota_mensual)}/mes` : null, d.tin !== null ? `${String(d.tin).replace(".", ",")} % TIN` : null, linked ? linked.nombre : null].filter(Boolean).join(" · ")
              return (
                <li key={d.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-500"><I className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{d.nombre}</p>
                      <Sensitive as="p" className="text-sm font-bold tabular-nums text-red-500 sm:hidden">−{eur(d.pendiente)}</Sensitive>
                      <Sensitive as="p" className="truncate text-xs text-muted-foreground">{meta}</Sensitive>
                      {pct !== null && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                          <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(pct)} % pagado</span>
                        </div>
                      )}
                    </div>
                    <Sensitive className="hidden shrink-0 text-sm font-bold tabular-nums text-red-500 sm:inline">−{eur(d.pendiente)}</Sensitive>
                    <RowActions label={d.nombre} onEdit={() => setDebtEdit(d)} onDelete={() => askDelete(d.nombre, () => deleteDebt(d.id), d.cuota_gasto_fijo ? " Su cuota dejará de aparecer en Gastos fijos; los pagos ya registrados se conservan." : "")} />
                  </div>
                  {debtEdit !== null && debtEdit !== "new" && debtEdit.id === d.id && <DebtForm initial={d} assets={assets} accounts={state.accounts} onCancel={() => setDebtEdit(null)} onSave={(x) => { if (d.cuota_gasto_fijo && !x.cuota_gasto_fijo && !window.confirm("¿Quitar la cuota de Gastos fijos? Los pagos ya registrados se conservan.")) return Promise.resolve(); return wrap(() => saveDebt(x), "Deuda guardada.").then(() => setDebtEdit(null)) }} />}
                </li>
              )
            })}
          </ul>
          {debts.length > 0 && <div className="mt-2 flex justify-between border-t border-dashed border-border pt-3 text-sm"><span className="text-muted-foreground">Total deudas{t.cuotas > 0 ? <> · cuotas <Sensitive>{eur(t.cuotas)}</Sensitive>/mes</> : null}</span><Sensitive className="font-bold tabular-nums text-red-500">−{eur(t.deudas)}</Sensitive></div>}
        </section>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground"><Scales className="mt-0.5 size-4 shrink-0 text-primary" />Patrimonio neto = cuentas + inversiones + bienes − deudas. Las cuentas en negativo (descubiertos, tarjetas) siguen contando como hasta ahora, así que no las apuntes otra vez aquí.</p>
    </div>
  )
}
