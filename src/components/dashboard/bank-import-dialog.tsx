"use client"

import { useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCircle, Upload } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sensitive } from "@/components/shared/sensitive"
import { useToast } from "@/components/ui/toast"
import { useDemo } from "@/lib/demo/context"
import { formatMoney } from "@/lib/currency"

import { dbDeleteIn } from "@/lib/db-client"
import { decodeBytes, findDuplicates, readBankCsv, toMovements, type BankTable, type ColumnMapping, type ParsedMovement } from "@/lib/bank-import"
import { generateId, useFinance, type Transaction } from "@/lib/store"
import { cn } from "@/lib/utils"

const MAX_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 20_000
const PAGE = 150

type Step = "elegir" | "revisar" | "hecho"
type Done = { ids: string[]; accountId: string; keepBalance: boolean; initialBefore: Transaction | null; undone: boolean }

const SELECT = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"

/** Extracto de ejemplo para la demo (formato tipo BBVA), con un movimiento
 * que ya existe para enseñar la detección de duplicados. */
function sampleCsv(existing: Transaction | undefined): string {
  const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() - offset); return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) }
  const lines = [
    "Movimientos de la cuenta;;;;",
    "F.Valor;Fecha;Concepto;Movimiento;Importe;Divisa",
    `${day(12)};${day(12)};MERCADONA AV. DEL PUERTO;Pago con tarjeta;-52,37;EUR`,
    `${day(10)};${day(10)};BIZUM DE LAURA - CENA;Bizum recibido;18,50;EUR`,
    `${day(9)};${day(9)};AMAZON EU SARL;Pago con tarjeta;-29,99;EUR`,
    `${day(7)};${day(7)};REPSOL ESTACION 2231;Pago con tarjeta;-48,00;EUR`,
    `${day(5)};${day(5)};CAFETERIA LA PLAZA;Pago con tarjeta;-3,40;EUR`,
    `${day(3)};${day(3)};DEVOLUCION ZALANDO;Abono;39,95;EUR`,
  ]
  if (existing) {
    const [y, m, d] = existing.fecha.split("-")
    lines.push(`${d}/${m}/${y};${d}/${m}/${y};${existing.descripcion || existing.categoria};Pago;${existing.tipo === "gasto" ? "-" : ""}${existing.monto.toFixed(2).replace(".", ",")};EUR`)
  }
  return lines.join("\n")
}

export function BankImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const demo = useDemo()
  const fileRef = useRef<HTMLInputElement>(null)
  const accounts = state.accounts
  const [accountId, setAccountId] = useState("")
  const [step, setStep] = useState<Step>("elegir")
  const [fileName, setFileName] = useState("")
  const [table, setTable] = useState<BankTable | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [keepBalance, setKeepBalance] = useState(true)
  const [error, setError] = useState("")
  const [shown, setShown] = useState(PAGE)
  const [done, setDone] = useState<Done | null>(null)
  const account = accounts.find((a) => a.id === (accountId || accounts[0]?.id))

  const parsed = useMemo(() => (table && mapping ? toMovements({ ...table, mapping }) : null), [table, mapping])
  const duplicates = useMemo(() => {
    if (!parsed || !account) return new Set<number>()
    return findDuplicates(parsed.movements, state.transactions.filter((t) => t.cuenta_id === account.id))
  }, [parsed, account, state.transactions])

  const reset = () => { setStep("elegir"); setTable(null); setMapping(null); setSelected(new Set()); setError(""); setShown(PAGE); setDone(null); setFileName("") }
  const close = (value: boolean) => { onOpenChange(value); if (!value) setTimeout(reset, 200) }

  const load = (text: string, name: string) => {
    const t = readBankCsv(text)
    if (!t || t.rows.length === 0) { setError("No encontramos movimientos en el archivo. ¿Es el CSV de movimientos de tu banco?"); return }
    if (t.rows.length > MAX_ROWS) { setError(`El archivo tiene más de ${MAX_ROWS.toLocaleString("es-ES")} filas. Descarga un periodo más corto.`); return }
    const movs = toMovements(t).movements
    if (!movs.length) { setError("No reconocemos las columnas de fecha e importe. Revísalas en el siguiente paso.") }
    else setError("")
    const dup = account ? findDuplicates(movs, state.transactions.filter((x) => x.cuenta_id === account.id)) : new Set<number>()
    setTable(t); setMapping(t.mapping); setFileName(name); setShown(PAGE)
    setSelected(new Set(movs.filter((m) => !dup.has(m.row)).map((m) => m.row)))
    setStep("revisar")
  }

  const onFile = async (file: File) => {
    setError("")
    if (!/\.(csv|txt)$/i.test(file.name) && file.type && !/csv|text/.test(file.type)) { setError("Sube el archivo en formato CSV (en tu banco: «Descargar movimientos» → CSV)."); return }
    if (file.size > MAX_BYTES) { setError("El archivo supera 10 MB. Descarga un periodo más corto."); return }
    try { load(decodeBytes(await file.arrayBuffer()), file.name) } catch { setError("No se pudo leer el archivo.") }
  }

  const changeMapping = (key: keyof ColumnMapping, value: number) => {
    if (!mapping || !table) return
    const next = { ...mapping, [key]: value }
    if (key === "amount" && value >= 0) { next.debit = -1; next.credit = -1 }
    if ((key === "debit" || key === "credit") && value >= 0) next.amount = -1
    setMapping(next)
    const movs = toMovements({ ...table, mapping: next }).movements
    const dup = account ? findDuplicates(movs, state.transactions.filter((x) => x.cuenta_id === account.id)) : new Set<number>()
    setSelected(new Set(movs.filter((m) => !dup.has(m.row)).map((m) => m.row)))
  }

  const categoryFor = (tipo: "ingreso" | "gasto") => {
    const names = new Set(state.categories.map((c) => c.name))
    if (tipo === "gasto" && names.has("Otros gastos")) return "Otros gastos"
    if (tipo === "ingreso" && names.has("Otros ingresos")) return "Otros ingresos"
    return "Otros"
  }

  const doImport = () => {
    if (!parsed || !account) return
    const batch = generateId()
    const chosen = parsed.movements.filter((m) => selected.has(m.row))
    if (!chosen.length) return
    const txs: Transaction[] = chosen.map((m) => ({
      id: generateId(), cuenta_id: account.id, monto: m.monto, fecha: m.fecha, tipo: m.tipo,
      categoria: categoryFor(m.tipo), es_necesidad: false, descripcion: m.descripcion, tags: ["importado", `importado:${batch}`],
    }))
    const initialBefore = state.transactions.find((t) => t.cuenta_id === account.id && t.categoria === "Saldo inicial" && (t.id.startsWith("init_") || t.id.startsWith("adj_init_"))) ?? null
    dispatch({ type: "IMPORT_TRANSACTIONS", payload: txs, accountId: account.id, keepBalance })
    setDone({ ids: txs.map((t) => t.id), accountId: account.id, keepBalance, initialBefore, undone: false })
    setStep("hecho")
  }

  const undo = () => {
    if (!done || done.undone) return
    dispatch({ type: "UNDO_IMPORT", ids: done.ids, accountId: done.accountId, keepBalance: done.keepBalance, initialBefore: done.initialBefore })
    if (!demo) dbDeleteIn("transactions", done.ids).then(() => {}, () => {})
    setDone({ ...done, undone: true })
    toast("Importación deshecha", "success")
  }

  const movements: ParsedMovement[] = parsed?.movements ?? []
  const chosen = movements.filter((m) => selected.has(m.row))
  const totals = chosen.reduce((acc, m) => { if (m.tipo === "gasto") acc.gastos += m.monto; else acc.ingresos += m.monto; return acc }, { gastos: 0, ingresos: 0 })
  const allSelected = movements.length > 0 && movements.every((m) => selected.has(m.row))
  const columnOptions = (table?.header ?? []).map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)
  const currency = account?.currency ?? "EUR"

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="z-[70] max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Importar movimientos del banco</DialogTitle>
          <DialogDescription>
            {step === "elegir" ? "Descarga los movimientos desde la web o la app de tu banco en CSV y súbelo aquí. El archivo se lee en tu dispositivo: no se envía a ningún sitio." : step === "revisar" ? `${fileName} · revisa y elige qué importar` : "Listo"}
          </DialogDescription>
        </DialogHeader>

        {step === "elegir" && (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">¿A qué cuenta pertenecen?</span>
              <select className={SELECT} value={account?.id ?? ""} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.banco ? ` · ${a.banco}` : ""}</option>)}
              </select>
            </label>
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = "" }} />
            <button type="button" disabled={!account} onClick={() => fileRef.current?.click()} className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/45 bg-primary/5 px-4 py-5 text-center transition-colors hover:bg-primary/10 disabled:opacity-50">
              <Upload className="size-7 text-primary" />
              <span className="text-base font-semibold">Elegir archivo CSV</span>
              <span className="text-xs text-muted-foreground">BBVA, ING, Santander, CaixaBank, Sabadell, Revolut, N26, MyInvestor…</span>
            </button>
            {demo && (
              <Button type="button" variant="outline" className="h-11 w-full" disabled={!account} onClick={() => load(sampleCsv(state.transactions.filter((t) => t.cuenta_id === account?.id && t.categoria !== "Saldo inicial").sort((a, b) => b.fecha.localeCompare(a.fecha))[0]), "extracto-ejemplo.csv")}>
                Probar con un extracto de ejemplo
              </Button>
            )}
            {error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500"><AlertCircle className="size-4 shrink-0" />{error}</p>}
          </div>
        )}

        {step === "revisar" && table && mapping && (
          <div className="space-y-4">
            <details className="rounded-xl border border-border bg-background/40 px-3 py-2" open={movements.length === 0}>
              <summary className="cursor-pointer text-sm font-medium">Columnas del archivo <span className="font-normal text-muted-foreground">(detectadas automáticamente)</span></summary>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([["date", "Fecha"], ["description", "Descripción"], ["amount", "Importe (con signo)"], ["debit", "Cargos / Debe"], ["credit", "Abonos / Haber"]] as const).map(([key, label]) => (
                  <label key={key} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <select className={SELECT} value={mapping[key]} onChange={(e) => changeMapping(key, Number(e.target.value))}>
                      <option value={-1}>—</option>{columnOptions}
                    </select>
                  </label>
                ))}
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Formato de fecha</span>
                  <select className={SELECT} value={table.dateOrder} onChange={(e) => setTable({ ...table, dateOrder: e.target.value as BankTable["dateOrder"] })}>
                    <option value="dmy">día/mes/año</option><option value="mdy">mes/día/año</option><option value="ymd">año-mes-día</option>
                  </select>
                </label>
              </div>
            </details>

            {error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500"><AlertCircle className="size-4 shrink-0" />{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" className="size-4 accent-[var(--gold)]" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(movements.map((m) => m.row)) : new Set())} />
                {chosen.length} de {movements.length} seleccionados
              </label>
              <span className="text-xs text-muted-foreground">{duplicates.size > 0 ? `${duplicates.size} ya estaban en Garra (desmarcados)` : "Sin duplicados"}{parsed && parsed.skipped > 0 ? ` · ${parsed.skipped} filas sin fecha o importe ignoradas` : ""}</span>
            </div>

            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {movements.slice(0, shown).map((m) => {
                const dup = duplicates.has(m.row)
                return (
                  <li key={m.row}>
                    <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5", dup && "bg-amber-500/5")}>
                      <input type="checkbox" className="size-4 shrink-0 accent-[var(--gold)]" checked={selected.has(m.row)} onChange={(e) => setSelected((prev) => { const next = new Set(prev); if (e.target.checked) next.add(m.row); else next.delete(m.row); return next })} />
                      <span className="w-[4.5rem] shrink-0 text-xs tabular-nums text-muted-foreground">{m.fecha.split("-").reverse().join("/")}</span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 break-words text-sm leading-tight">{m.descripcion || "(sin descripción)"}</span>
                        {dup && <span className="mt-0.5 block text-[11px] font-medium text-amber-500">Ya existe en Garra</span>}
                      </span>
                      <Sensitive className={cn("shrink-0 text-sm font-semibold tabular-nums", m.tipo === "ingreso" ? "text-emerald-500" : "text-foreground")}>{m.tipo === "ingreso" ? "+" : "−"}{formatMoney(m.monto, currency)}</Sensitive>
                    </label>
                  </li>
                )
              })}
            </ul>
            {movements.length > shown && <Button type="button" variant="ghost" className="w-full" onClick={() => setShown((n) => n + PAGE * 4)}>Ver más ({movements.length - shown})</Button>}

            <label className="flex items-start gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--gold)]" checked={keepBalance} onChange={(e) => setKeepBalance(e.target.checked)} />
              <span><span className="block font-medium">Mantener el saldo actual de {account?.nombre}</span><span className="block text-xs text-muted-foreground">Márcalo si el saldo de Garra ya está al día con el banco (lo normal). Si lo desmarcas, el saldo cambiará con estos movimientos.</span></span>
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={reset}>Elegir otro archivo</Button>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs text-muted-foreground"><Sensitive>−{formatMoney(totals.gastos, currency)} · +{formatMoney(totals.ingresos, currency)}</Sensitive></span>
                <Button type="button" className="h-11 px-5" disabled={!chosen.length} onClick={doImport}>Importar {chosen.length}</Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Se guardan con la categoría «Otros»; puedes cambiarla luego en Movimientos.</p>
          </div>
        )}

        {step === "hecho" && done && (
          <div className="space-y-4 text-center">
            <CheckCircle className="mx-auto size-10 text-emerald-500" />
            <p className="text-base font-semibold">{done.undone ? "Importación deshecha" : `${done.ids.length} ${done.ids.length === 1 ? "movimiento importado" : "movimientos importados"} en ${account?.nombre}`}</p>
            <p className="text-sm text-muted-foreground">{done.undone ? "No ha quedado ningún movimiento de este archivo." : done.keepBalance ? "El saldo actual de la cuenta no ha cambiado." : "El saldo de la cuenta se ha actualizado."}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {!done.undone && <Button type="button" variant="outline" onClick={undo}>Deshacer importación</Button>}
              <Button type="button" onClick={() => close(false)}>Hecho</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function BankImportButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Importar del banco
      </Button>
      <BankImportDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

