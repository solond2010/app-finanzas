"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useFinance, useSyncStatus, type CategoryKind } from "@/lib/store"
import { useInvestmentSyncStatus } from "@/lib/investments"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { Plus, Trash2, Download, SlidersHorizontal, Tags, FileDown, Layers, Search, Pencil, Check, X, Cloud, CloudOff, Loader2, HardDrive, ShieldCheck, ShieldAlert } from "lucide-react"
import { Skeleton } from "@/components/shared/skeleton"
import { auditFinanceState } from "@/lib/finance-integrity"

export default function ConfiguracionPage() {
  const { state, loading, dispatch } = useFinance()
  const { status: syncStatus, lastSyncedAt, retrySync, localBackupStatus, retryLocalBackup } = useSyncStatus()
  const { status: investmentSyncStatus, retrySync: retryInvestmentSync } = useInvestmentSyncStatus()
  const backupBlocked = ["syncing", "error", "offline"].includes(syncStatus) || ["syncing", "error", "offline"].includes(investmentSyncStatus)
  const syncFailed = syncStatus === "error" || syncStatus === "offline" || investmentSyncStatus === "error" || investmentSyncStatus === "offline"
  const syncIcon = syncFailed ? CloudOff : backupBlocked ? Loader2 : Cloud
  const SyncIcon = syncIcon
  const lastSyncLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString("es-ES", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Aún no hay un guardado confirmado desde este navegador"
  const syncLabel = syncFailed
    ? syncStatus === "offline" || investmentSyncStatus === "offline" ? "Sin conexión" : "No se pudo guardar"
    : backupBlocked ? "Sincronizando cambios…" : syncStatus === "saved" || investmentSyncStatus === "saved" ? "Guardado en la nube" : "Último estado de sincronización"
  const { toast } = useToast()
  const [newCat, setNewCat] = useState("")
  const [newCatKind, setNewCatKind] = useState<"ingreso" | "gasto">("gasto")
  const [categorySearch, setCategorySearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const integrityFindings = useMemo(() => auditFinanceState(state), [state])

  const addCategory = () => {
    const name = newCat.trim()
    if (!name) return
    // Comparación sin distinguir mayúsculas/tildes de caja: "Suscripciones" y
    // "suscripciones" son la misma categoría para quien la usa, y antes de
    // este fix el check exacto dejaba pasar duplicados con distinta capitalización.
    if (state.categories.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) {
      toast("Esa categoría ya existe", "error")
      return
    }
    dispatch({ type: "ADD_CATEGORY", payload: { name, color: "#64748b", kind: newCatKind } })
    setNewCat("")
    toast(`Categoría "${name}" creada`, "success")
  }

  const catGroups: { key: CategoryKind; label: string }[] = [
    { key: "ingreso", label: "Ingresos" },
    { key: "gasto", label: "Gastos" },
    { key: "both", label: "Ambos" },
  ]

  const deleteCategory = (id: string, name: string) => {
    const inUse = state.transactions.some((t) => t.categoria === name)
    // Las transacciones referencian la categoría por NOMBRE: si existe otra
    // categoría duplicada con el mismo nombre, borrar esta copia es inocuo
    // (ninguna transacción se queda huérfana). Sin esta comprobación, un
    // nombre duplicado con movimientos quedaba imposible de limpiar: las dos
    // copias se bloqueaban mutuamente para siempre.
    const isLastWithName = state.categories.filter((c) => c.name === name).length <= 1
    if (inUse && isLastWithName) {
      toast("No puedes eliminar una categoría con transacciones", "error")
      return
    }
    dispatch({ type: "DELETE_CATEGORY", payload: id })
    toast(`Categoría "${name}" eliminada`, "success")
  }

  const saveCategoryName = (id: string) => {
    const category = state.categories.find((c) => c.id === id)
    const name = editingName.trim()
    if (!category || !name) return
    if (state.categories.some((c) => c.id !== id && c.name.trim().toLowerCase() === name.toLowerCase())) { toast("Ya existe una categoría con ese nombre", "error"); return }
    if (state.categories.filter((c) => c.name === category.name).length > 1 && name !== category.name) { toast("Hay categorías duplicadas con este nombre; renombra primero las otras para evitar mover movimientos incorrectos", "error"); return }
    dispatch({ type: "UPDATE_CATEGORY", payload: { ...category, name } })
    setEditingId(null)
    toast("Categoría actualizada; sus movimientos conservaron la categoría", "success")
  }

  const exportBackup = async () => {
    try {
      const response = await fetch("/api/backup", { cache: "no-store" })
      if (!response.ok) throw new Error("No se pudo leer la copia completa desde la nube")
      const backup = await response.blob()
      if (!backup.size) throw new Error("La copia recibida está vacía")
      const url = URL.createObjectURL(backup)
      const a = document.createElement("a")
      a.href = url
      a.download = `app-finanzas-backup_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      toast("Copia completa descargada", "success")
    } catch (error) {
      toast(error instanceof Error ? error.message : "No se pudo descargar la copia", "error")
    }
  }

  const csvCell = (value: unknown) => {
    const text = String(value ?? "")
    const safe = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }

  const exportCSV = () => {
    const headers = ["fecha", "tipo", "categoria", "descripcion", "monto", "cuenta", "tags"]
    const rows = state.transactions.map((t) => {
      const account = state.accounts.find((a) => a.id === t.cuenta_id)
      return [t.fecha, t.tipo, t.categoria, t.descripcion, t.monto, account?.nombre ?? "", t.tags.join(", ")].map(csvCell).join(",")
    })
    const csv = [headers.map(csvCell).join(","), ...rows].join("\r\n")
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
    <div className="content-fade space-y-6 sm:space-y-7">
      <section className="rounded-[16px] border border-border bg-card p-6 sm:p-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            Configuración
          </div>
          <div className="space-y-2">
            <p className="page-section-label">Ajustes</p>
            <h1 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Personaliza tu espacio financiero.</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Gestiona categorías, exporta tus datos y mantén el control de toda tu información.</p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" /><Skeleton className="h-40" />
        </div>
      ) : (
      // items-start: sin él, la tarjeta "Exportar datos" se estira hasta igualar
      // la altura de "Categorías" (42 etiquetas) y queda con ~400px vacíos.
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Layers className="h-4 w-4 text-amber-500" />
              Categorías
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">{state.categories.length} categorías configuradas</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="inline-flex rounded-full bg-muted/60 p-0.5 text-xs font-semibold">
                <button onClick={() => setNewCatKind("gasto")} className={cn("rounded-full px-3 py-1 transition-colors", newCatKind === "gasto" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Gasto</button>
                <button onClick={() => setNewCatKind("ingreso")} className={cn("rounded-full px-3 py-1 transition-colors", newCatKind === "ingreso" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Ingreso</button>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tags className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder={`Nueva categoría de ${newCatKind}`}
                    className="pl-8"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory() } }}
                  />
                </div>
                <Button size="sm" className="gap-1 shrink-0" onClick={addCategory}>
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </Button>
              </div>
            </div>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} placeholder="Buscar categoría…" className="pl-9" /></div>
            <div className="space-y-4">
              {catGroups.map(({ key, label }) => {
                const cats = state.categories.filter((c) => (c.kind ?? "both") === key && c.name.toLowerCase().includes(categorySearch.trim().toLowerCase()))
                if (cats.length === 0) return null
                return (
                  <div key={key} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {cats.map((cat) => (
                        <div key={cat.id} className="stagger-fade group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 bg-muted/60 text-foreground ring-border/40">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {editingId === cat.id ? <><Input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-7 w-32 bg-background px-2 text-xs" onKeyDown={(e) => { if (e.key === "Enter") saveCategoryName(cat.id); if (e.key === "Escape") setEditingId(null) }} /><button onClick={() => saveCategoryName(cat.id)} aria-label="Guardar categoría"><Check className="h-3 w-3 text-emerald-500" /></button><button onClick={() => setEditingId(null)} aria-label="Cancelar"><X className="h-3 w-3" /></button></> : <><span>{cat.name}</span><button onClick={() => { setEditingId(cat.id); setEditingName(cat.name) }} aria-label={`Renombrar categoría ${cat.name}`} className="opacity-50 hover:opacity-100"><Pencil className="h-3 w-3" /></button></>}
                          <button onClick={() => deleteCategory(cat.id, cat.name)} className="opacity-40 group-hover:opacity-100 transition-opacity hover:opacity-100 cursor-pointer" aria-label={`Eliminar categoría ${cat.name}`}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {categorySearch && !state.categories.some((c) => c.name.toLowerCase().includes(categorySearch.trim().toLowerCase())) && <p className="py-5 text-center text-sm text-muted-foreground">No hay categorías coincidentes.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FileDown className="h-4 w-4 text-blue-500" />
              Exportar datos
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">{state.transactions.length} transacciones registradas</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-muted/30 p-4 ring-1 ring-border/20">
              <div className="space-y-1">
                <p className="text-sm font-medium">Descarga tu histórico</p>
                <p className="text-xs text-muted-foreground">Todas tus transacciones en formato CSV listas para analizar en Excel o Google Sheets.</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0 ml-4" onClick={exportCSV}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/30 p-4 ring-1 ring-border/20">
              <div className="space-y-1"><p className="text-sm font-medium">Copia completa</p><p className="text-xs text-muted-foreground">Incluye cuentas, movimientos, metas, presupuestos, inversiones y ajustes. Solo descarga datos ya sincronizados.</p></div>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={exportBackup} disabled={backupBlocked}>
                <Download className="h-3.5 w-3.5" /> JSON
              </Button>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/35 p-4" role="status" aria-live="polite">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", syncFailed ? "bg-red-500/10 text-red-500" : backupBlocked ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")}>
                <SyncIcon className={cn("h-4 w-4", backupBlocked && !syncFailed && "animate-spin")} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{syncLabel}</span>
                <span className="block truncate text-xs text-muted-foreground">Último guardado confirmado: {lastSyncLabel}</span>
              </span>
              {syncFailed && <Button variant="outline" size="sm" className="shrink-0" onClick={() => { retrySync(); retryInvestmentSync() }}>Reintentar</Button>}
            </div>
            <div className={cn("flex items-center gap-3 rounded-2xl border p-4", localBackupStatus === "error" ? "border-red-500/25 bg-red-500/5" : "border-border/70 bg-background/35")} role="status" aria-live="polite">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", localBackupStatus === "error" ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500")}><HardDrive className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{localBackupStatus === "error" ? "Copia local no actualizada" : localBackupStatus === "saved" ? "Copia local actualizada" : "Copia local de este navegador"}</span>
                <span className="block text-xs text-muted-foreground">{localBackupStatus === "error" ? "El almacenamiento del navegador puede estar lleno; comprueba que la nube figure como guardada." : "Último estado de recuperación disponible en este navegador y dispositivo."}</span>
              </span>
              {localBackupStatus === "error" && <Button variant="outline" size="sm" className="shrink-0" onClick={retryLocalBackup}>Reintentar</Button>}
            </div>
            <div className={cn("rounded-2xl border p-4", integrityFindings.length ? "border-amber-500/25 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5")}>
              <div className="flex items-start gap-3">
                {integrityFindings.length ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{integrityFindings.length ? "Revisión de datos: requiere atención" : "Revisión de datos: sin incidencias detectadas"}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Se comprueban identificadores, referencias entre registros, importes, fechas y consistencia entre saldos e historial. La revisión no modifica tus datos.</p>
                  {integrityFindings.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">{integrityFindings.map((finding) => <li key={finding.code}>{finding.count} · {finding.label}</li>)}</ul>}
                </div>
              </div>
            </div>
            <p className="px-1 text-xs text-muted-foreground">En este Mac se guarda al iniciar sesión si falta la copia del mes y los días 1 y 2 a las 09:15, en Documentos → Finanzas Backups.</p>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  )
}
