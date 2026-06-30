"use client"

import { useRef } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFinance, generateId, type Transaction } from "@/lib/store"
import { useToast } from "@/components/ui/toast"

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field); field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field); rows.push(row); row = []; field = ""
    } else field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}

export function ImportCsvButton() {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (rows.length < 2) { toast("El CSV está vacío", "error"); return }

      const header = rows[0].map((h) => h.trim().toLowerCase())
      const col = (name: string) => header.indexOf(name)
      const iFecha = col("fecha"), iTipo = col("tipo"), iCat = col("categoria"), iDesc = col("descripcion"), iMonto = col("monto"), iCuenta = col("cuenta"), iTags = col("tags")
      if (iFecha < 0 || iTipo < 0 || iMonto < 0 || iCuenta < 0) { toast("Formato de CSV no reconocido", "error"); return }

      const accByName = new Map(state.accounts.map((a) => [a.nombre.trim().toLowerCase(), a.id]))
      const sig = (t: { fecha: string; tipo: string; monto: number; categoria: string; descripcion: string; cuenta_id: string }) =>
        `${t.fecha}|${t.tipo}|${t.monto}|${t.categoria}|${t.descripcion.trim()}|${t.cuenta_id}`
      const existing = new Set(state.transactions.map(sig))

      let added = 0, skipped = 0, unmatched = 0
      for (const r of rows.slice(1)) {
        const categoria = (r[iCat] ?? "").trim()
        if (categoria === "Saldo inicial") continue // las genera la app desde el saldo
        const cuenta_id = accByName.get((r[iCuenta] ?? "").trim().toLowerCase())
        if (!cuenta_id) { unmatched++; continue }
        const tipo = (r[iTipo] ?? "").trim() === "ingreso" ? "ingreso" : "gasto"
        const monto = Math.abs(Number(r[iMonto]) || 0)
        if (monto === 0) { skipped++; continue }
        const tx: Transaction = {
          id: generateId(),
          cuenta_id,
          monto,
          fecha: (r[iFecha] ?? "").trim(),
          tipo,
          categoria,
          es_necesidad: false,
          descripcion: (r[iDesc] ?? "").trim(),
          tags: iTags >= 0 ? (r[iTags] ?? "").split(",").map((t) => t.trim()).filter(Boolean) : [],
        }
        if (existing.has(sig(tx))) { skipped++; continue }
        dispatch({ type: "ADD_TRANSACTION", payload: tx })
        existing.add(sig(tx))
        added++
      }

      const parts = [`${added} importada${added === 1 ? "" : "s"}`, `${skipped} ya existían`]
      if (unmatched > 0) parts.push(`${unmatched} sin cuenta`)
      toast(parts.join(" · "), added > 0 ? "success" : "info")
    } catch {
      toast("No se pudo leer el archivo", "error")
    }
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
    </>
  )
}
