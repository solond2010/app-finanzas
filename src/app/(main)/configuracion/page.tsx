"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useFinance } from "@/lib/store"
import { useToast } from "@/components/ui/toast"
import { Settings, Plus, Trash2, Download } from "lucide-react"

const CATEGORY_COLORS: Record<string, string> = {
  Salario: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Alquiler: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Supermercado: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Transporte: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Internet: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  Cena: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  Suscripciones: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  Ropa: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  Transferencia: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  Ocio: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  Gym: "bg-lime-500/10 text-lime-600 dark:text-lime-400",
  Salud: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  Freelance: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  Inversión: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  Otros: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
}

export default function ConfiguracionPage() {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const [newCat, setNewCat] = useState("")

  const addCategory = () => {
    const name = newCat.trim()
    if (!name) return
    if (state.categories.includes(name)) {
      toast("Esa categoría ya existe", "error")
      return
    }
    dispatch({ type: "ADD_CATEGORY", payload: name })
    setNewCat("")
    toast(`Categoría "${name}" creada`, "success")
  }

  const deleteCategory = (name: string) => {
    const inUse = state.transactions.some((t) => t.categoria === name)
    if (inUse) {
      toast("No puedes eliminar una categoría con transacciones", "error")
      return
    }
    dispatch({ type: "DELETE_CATEGORY", payload: name })
    toast(`Categoría "${name}" eliminada`, "success")
  }

  const exportCSV = () => {
    const headers = ["fecha", "tipo", "categoria", "descripcion", "monto", "cuenta", "tags"]
    const rows = state.transactions.map((t) => {
      const account = state.accounts.find((a) => a.id === t.cuenta_id)
      return [t.fecha, t.tipo, t.categoria, `"${t.descripcion}"`, t.monto, account?.nombre ?? "", `"${t.tags.join(", ")}"`].join(",")
    })
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `finanzas_${new Date().toISOString().slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast("CSV exportado", "success")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">Gestiona categorías y exporta tus datos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Exportar datos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Descarga todas tus transacciones en formato CSV</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Categorías
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nueva categoría" onKeyDown={(e) => e.key === "Enter" && addCategory()} />
            <Button size="sm" className="gap-1" onClick={addCategory}><Plus className="h-3.5 w-3.5" /> Añadir</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.categories.map((cat) => {
              const colorClass = CATEGORY_COLORS[cat] || "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
              return (
                <div key={cat} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${colorClass}`}>
                  {cat}
                  <button onClick={() => deleteCategory(cat)} className="hover:opacity-60">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
