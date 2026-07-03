"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useFinance, generateId, type Transaction } from "@/lib/store"
import { useToast } from "@/components/ui/toast"
import { readFileSmart, detectDelimiter, parseCsv, normalizeDate } from "@/lib/csv-import"

interface ImportSummary {
  toImport: Transaction[]
  added: number
  duplicates: number
  unmatched: number
  invalidAmount: number
  invalidDate: number
}

export function ImportCsvButton() {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const handleFile = async (file: File) => {
    try {
      const text = await readFileSmart(file)
      const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
      const delimiter = detectDelimiter(firstLine)
      const rows = parseCsv(text, delimiter)
      if (rows.length < 2) { toast("El CSV está vacío", "error"); return }

      const header = rows[0].map((h) => h.trim().toLowerCase())
      const col = (name: string) => header.indexOf(name)
      const iFecha = col("fecha"), iTipo = col("tipo"), iCat = col("categoria"), iDesc = col("descripcion"), iMonto = col("monto"), iCuenta = col("cuenta"), iTags = col("tags")
      if (iFecha < 0 || iTipo < 0 || iMonto < 0 || iCuenta < 0) { toast("Formato de CSV no reconocido: faltan columnas fecha/tipo/monto/cuenta", "error"); return }

      const accByName = new Map(state.accounts.map((a) => [a.nombre.trim().toLowerCase(), a.id]))
      const sig = (t: { fecha: string; tipo: string; monto: number; categoria: string; descripcion: string; cuenta_id: string }) =>
        `${t.fecha}|${t.tipo}|${t.monto}|${t.categoria}|${t.descripcion.trim()}|${t.cuenta_id}`
      const existing = new Set(state.transactions.map(sig))

      const toImport: Transaction[] = []
      let duplicates = 0, unmatched = 0, invalidAmount = 0, invalidDate = 0

      for (const r of rows.slice(1)) {
        const categoria = (r[iCat] ?? "").trim()
        if (categoria === "Saldo inicial") continue // las genera la app desde el saldo
        const cuenta_id = accByName.get((r[iCuenta] ?? "").trim().toLowerCase())
        if (!cuenta_id) { unmatched++; continue }
        const fecha = normalizeDate(r[iFecha] ?? "")
        if (!fecha) { invalidDate++; continue }
        const tipo = (r[iTipo] ?? "").trim() === "ingreso" ? "ingreso" : "gasto"
        const monto = Math.abs(Number((r[iMonto] ?? "").replace(",", ".")))
        if (!Number.isFinite(monto) || monto <= 0) { invalidAmount++; continue }
        const tx: Transaction = {
          id: generateId(),
          cuenta_id,
          monto,
          fecha,
          tipo,
          categoria,
          es_necesidad: false,
          descripcion: (r[iDesc] ?? "").trim(),
          tags: iTags >= 0 ? (r[iTags] ?? "").split(",").map((t) => t.trim()).filter(Boolean) : [],
        }
        if (existing.has(sig(tx))) { duplicates++; continue }
        existing.add(sig(tx))
        toImport.push(tx)
      }

      setSummary({ toImport, added: toImport.length, duplicates, unmatched, invalidAmount, invalidDate })
    } catch {
      toast("No se pudo leer el archivo", "error")
    }
  }

  const confirmImport = () => {
    if (!summary) return
    for (const tx of summary.toImport) dispatch({ type: "ADD_TRANSACTION", payload: tx })
    toast(`${summary.added} movimiento${summary.added === 1 ? "" : "s"} importado${summary.added === 1 ? "" : "s"}`, summary.added > 0 ? "success" : "info")
    setSummary(null)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = "" }}
      />
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" /> Importar CSV
      </Button>

      <ConfirmDialog
        open={summary !== null}
        onOpenChange={(open) => { if (!open) setSummary(null) }}
        onConfirm={confirmImport}
        title="Confirmar importación"
        confirmLabel={summary ? `Importar ${summary.added}` : "Importar"}
        description={
          summary && (
            <div className="space-y-1 text-left text-sm">
              <p className="font-medium text-foreground">{summary.added} movimiento{summary.added === 1 ? "" : "s"} listo{summary.added === 1 ? "" : "s"} para importar.</p>
              {summary.duplicates > 0 && <p>· {summary.duplicates} ya existían (se omiten)</p>}
              {summary.unmatched > 0 && <p>· {summary.unmatched} sin cuenta coincidente</p>}
              {summary.invalidDate > 0 && <p>· {summary.invalidDate} con fecha no reconocida</p>}
              {summary.invalidAmount > 0 && <p>· {summary.invalidAmount} con importe no válido</p>}
            </div>
          )
        }
      />
    </>
  )
}
