"use client"

import { useEffect, useState } from "react"
import { type Account, generateId } from "@/lib/store"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CURRENCY_OPTIONS, currencySymbol } from "@/lib/currency"
import { BANKS, matchBank } from "@/components/dashboard/account-logo"

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
    })
  }, [account, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      id: account?.id ?? generateId(),
      nombre,
      tipo,
      banco,
      saldo: Number(saldo) || 0,
      currency,
      objetivo: objetivo ? Number(objetivo) : null,
      limite_mensual: limiteMensual ? Number(limiteMensual) : null,
      color,
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
              <Input type="number" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Sin objetivo" />
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
