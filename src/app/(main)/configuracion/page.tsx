"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useFinance } from "@/lib/store"
import { useToast } from "@/components/ui/toast"
import { Plus, Trash2, Download, Sparkles, Tags, FileDown, Layers } from "lucide-react"

export default function ConfiguracionPage() {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const [newCat, setNewCat] = useState("")

  const addCategory = () => {
    const name = newCat.trim()
    if (!name) return
    if (state.categories.some(c => c.name === name)) {
      toast("Esa categoría ya existe", "error")
      return
    }
    dispatch({ type: "ADD_CATEGORY", payload: { name, color: "#64748b" } })
    setNewCat("")
    toast(`Categoría "${name}" creada`, "success")
  }

  const deleteCategory = (id: string, name: string) => {
    const inUse = state.transactions.some((t) => t.categoria === name)
    if (inUse) {
      toast("No puedes eliminar una categoría con transacciones", "error")
      return
    }
    dispatch({ type: "DELETE_CATEGORY", payload: id })
    toast(`Categoría "${name}" eliminada`, "success")
  }

  const exportCSV = () => {
    const headers = ["fecha", "tipo", "categoria", "descripcion", "monto", "cuenta", "tags"]
    const rows = state.transactions.map((t) => {
      const account = state.accounts.find((a) => a.id === t.cuenta_id)
      return [t.fecha, t.tipo, t.categoria, `"${t.descripcion.replaceAll('"', '""')}"`, t.monto, account?.nombre ?? "", `"${t.tags.join(", ").replaceAll('"', '""')}"`].join(",")
    })
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `finanzas_${new Date().toISOString().slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast("CSV exportado correctamente", "success")
  }

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[32px] bg-card/70 p-6 shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-8">
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            Configuración
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ajustes</p>
            <h1 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Personaliza tu espacio financiero.</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Gestiona categorías, exporta tus datos y mantén el control de toda tu información.</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="relative overflow-hidden ring-1 ring-border/25">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Layers className="h-4 w-4 text-amber-500" />
              Categorías
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">{state.categories.length} categorías configuradas</p>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tags className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="Nueva categoría"
                  className="pl-8"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory() } }}
                />
              </div>
              <Button size="sm" className="gap-1 shrink-0" onClick={addCategory}>
                <Plus className="h-3.5 w-3.5" /> Añadir
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {state.categories.map((cat) => {
                return (
                  <div key={cat.id} className="stagger-fade group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                    <button onClick={() => deleteCategory(cat.id, cat.name)} className="opacity-40 group-hover:opacity-100 transition-opacity hover:opacity-100 cursor-pointer" aria-label={`Eliminar categoría ${cat.name}`}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden ring-1 ring-border/25">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FileDown className="h-4 w-4 text-blue-500" />
              Exportar datos
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">{state.transactions.length} transacciones registradas</p>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center justify-between rounded-2xl bg-muted/30 p-4 ring-1 ring-border/20">
              <div className="space-y-1">
                <p className="text-sm font-medium">Descarga tu histórico</p>
                <p className="text-xs text-muted-foreground">Todas tus transacciones en formato CSV listas para analizar en Excel o Google Sheets.</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0 ml-4" onClick={exportCSV}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
