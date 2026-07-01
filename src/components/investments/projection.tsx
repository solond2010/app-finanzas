"use client"

import { useState } from "react"
import { BarChart } from "@tremor/react"
import { LineChart as LineChartIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { chartFormatter } from "@/lib/format"
import { createChartTooltip } from "@/components/shared/chart-tooltip"

const CARD = "rounded-[24px] border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"
const ProjectionTooltip = createChartTooltip(["Ahorros", "Inversiones"], ["blue", "emerald"])

interface Row {
  year: number
  Ahorros: number
  Inversiones: number
  aportAh: number
  aportInv: number
  intAh: number
  intInv: number
  total: number
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function ProjectionSimulator({ ahorros0, inversiones0 }: { ahorros0: number; inversiones0: number }) {
  const thisYear = new Date().getFullYear()
  const [objetivo, setObjetivo] = useState("600000")
  const [aInv, setAInv] = useState("500")
  const [aAh, setAAh] = useState("200")
  const [rInv, setRInv] = useState("8")
  const [rAh, setRAh] = useState("2")
  const [years, setYears] = useState("25")
  const [rows, setRows] = useState<Row[] | null>(null)

  const generate = () => {
    const n = Math.max(1, Math.min(Math.round(Number(years) || 0), 60))
    const mInv = Number(aInv) || 0
    const mAh = Number(aAh) || 0
    const pInv = Number(rInv) || 0
    const pAh = Number(rAh) || 0
    const out: Row[] = []
    let ah = ahorros0
    let inv = inversiones0
    for (let y = 1; y <= n; y++) {
      const intAh = (ah * pAh) / 100
      const intInv = (inv * pInv) / 100
      ah += intAh + mAh * 12
      inv += intInv + mInv * 12
      out.push({ year: thisYear + y, Ahorros: Math.round(ah), Inversiones: Math.round(inv), aportAh: mAh * 12, aportInv: mInv * 12, intAh: Math.round(intAh), intInv: Math.round(intInv), total: Math.round(ah + inv) })
    }
    setRows(out)
  }

  const obj = Number(objetivo) || 0
  const finalTotal = rows?.[rows.length - 1]?.total ?? 0
  const reached = rows?.find((r) => r.total >= obj)
  const eur = (n: number) => formatMoney(n, "EUR")

  return (
    <section className={`${CARD} min-w-0`}>
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><LineChartIcon className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-semibold text-foreground">Proyección de patrimonio</p>
          <p className="text-xs text-muted-foreground">Simula tu crecimiento y tu objetivo de retiro</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="space-y-1 rounded-2xl bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Ahorros actuales</span><span className="font-semibold tabular-nums"><Sensitive>{eur(ahorros0)}</Sensitive></span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Inversiones actuales</span><span className="font-semibold tabular-nums"><Sensitive>{eur(inversiones0)}</Sensitive></span></div>
          </div>
          <Field label="Objetivo para tu retiro (€)" value={objetivo} onChange={setObjetivo} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Aport. mensual inv. (€)" value={aInv} onChange={setAInv} />
            <Field label="Aport. mensual ahorro (€)" value={aAh} onChange={setAAh} />
            <Field label="Rendim. inversiones (%)" value={rInv} onChange={setRInv} />
            <Field label="Rendim. ahorros (%)" value={rAh} onChange={setRAh} />
          </div>
          <Field label="Número de años" value={years} onChange={setYears} />
          <Button onClick={generate} className="w-full">Generar proyección</Button>
        </div>

        <div className="min-w-0">
          {!rows ? (
            <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl bg-muted/30 text-center text-sm text-muted-foreground">Introduce los valores y pulsa «Generar» para ver la proyección.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Patrimonio final</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground sm:text-2xl"><Sensitive>{eur(finalTotal)}</Sensitive></p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Objetivo alcanzado</p>
                  <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl" style={{ color: reached ? "#10b981" : "#ef4444" }}>{reached ? `${reached.year}` : "No alcanzado"}{reached && <span className="ml-1 text-xs font-medium text-muted-foreground">({reached.year - thisYear} años)</span>}</p>
                </div>
              </div>

              <BarChart data={rows} index="year" categories={["Ahorros", "Inversiones"]} colors={["blue", "emerald"]} stack valueFormatter={chartFormatter} showLegend showYAxis={false} customTooltip={ProjectionTooltip} className="h-60" showAnimation />

              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[640px] text-right text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 text-left font-semibold">Año</th>
                      <th className="px-3 py-2 font-semibold">Ahorros</th>
                      <th className="px-3 py-2 font-semibold">Inversiones</th>
                      <th className="px-3 py-2 font-semibold">Aport. inv.</th>
                      <th className="px-3 py-2 font-semibold">Aport. ahorro</th>
                      <th className="px-3 py-2 font-semibold">Int. ahorro</th>
                      <th className="px-3 py-2 font-semibold">Int. inv.</th>
                      <th className="px-3 py-2 font-semibold">Patrimonio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.year} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-1.5 text-left font-medium text-foreground">{r.year}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.Ahorros.toLocaleString("es-ES")}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.Inversiones.toLocaleString("es-ES")}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.aportInv.toLocaleString("es-ES")}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.aportAh.toLocaleString("es-ES")}</td>
                        <td className="px-3 py-1.5 text-emerald-500">{r.intAh.toLocaleString("es-ES")}</td>
                        <td className="px-3 py-1.5 text-emerald-500">{r.intInv.toLocaleString("es-ES")}</td>
                        <td className="px-3 py-1.5 font-bold text-foreground">{r.total.toLocaleString("es-ES")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
