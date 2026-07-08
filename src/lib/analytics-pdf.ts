import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatMoney } from "@/lib/currency"
import { BRAND, GOLD, INK, MUTED, GREEN, RED, renderBarChart, drawTileGrid, drawProgressBar, ensureSpace, drawFooter } from "@/lib/pdf-helpers"

interface AnalyticsPdfBudgetRow {
  categoria: string
  gastado: number
  limite: number
}

interface AnalyticsPdfCategoryRow {
  categoria: string
  monto: number
}

interface AnalyticsPdfInsight {
  categoria: string
  current: number
  average: number
  deltaPct: number
  isNew: boolean
}

export interface AnalyticsPdfData {
  owner: string
  month: string
  netWorth: number
  netWorthChange: number
  ingresos: number
  gastos: number
  neto: number
  savingsRate: number
  netWorthTrend: { label: string; value: number }[]
  categoryBreakdown: AnalyticsPdfCategoryRow[]
  necesidadesPct: number
  deseosPct: number
  ahorroPct: number
  budgets: AnalyticsPdfBudgetRow[]
  insights: AnalyticsPdfInsight[]
}

export function generateAnalyticsPdf(data: AnalyticsPdfData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const m = (v: number) => formatMoney(v, "EUR")
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${formatMoney(Math.abs(v), "EUR")}`

  doc.setFillColor(...BRAND)
  doc.rect(0, 0, W, 90, "F")
  doc.setFillColor(...GOLD)
  doc.rect(0, 90, W, 3, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.text("Informe de Analíticas", M, 42)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
  doc.text(`${data.owner} · ${data.month} · Generado el ${today}`, M, 62)

  let y = 120

  // KPIs del mes
  y = drawTileGrid(doc, M, y, W - M * 2, 12, [
    { label: "Patrimonio", value: m(data.netWorth), color: data.netWorthChange >= 0 ? GREEN : RED },
    { label: "Ingresos", value: signed(data.ingresos), color: GREEN },
    { label: "Gastos", value: signed(-data.gastos), color: RED },
    { label: "Neto", value: signed(data.neto), color: data.neto >= 0 ? GREEN : RED },
  ], 4, 60)
  y += 24

  // Evolución del patrimonio (6 meses)
  if (data.netWorthTrend.length > 1) {
    const chartH = 140
    y = ensureSpace(doc, y, 30 + chartH)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Evolución del patrimonio (6 meses)", M, y)
    const chartY = y + 10
    const img = renderBarChart(data.netWorthTrend, W - M * 2, chartH, m)
    doc.addImage(img, "PNG", M, chartY, W - M * 2, chartH)
    y = chartY + chartH + 24
  }

  // Regla 50/30/20
  y = ensureSpace(doc, y, 30 + 60)
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("Regla 50/30/20", M, y)
  y += 16
  const ruleW = (W - M * 2 - 24) / 3
  const rules: [string, number, number, [number, number, number]][] = [
    ["Necesidades (obj. 50%)", data.necesidadesPct, 50, GREEN],
    ["Deseos (obj. 30%)", data.deseosPct, 30, [217, 119, 6]],
    ["Ahorro (obj. 20%)", data.ahorroPct, 20, BRAND],
  ]
  rules.forEach(([label, pct], i) => {
    const x = M + i * (ruleW + 12)
    doc.setTextColor(...MUTED)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.text(label.toUpperCase(), x, y)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text(`${Math.round(pct)}%`, x, y + 18)
    drawProgressBar(doc, x, y + 26, ruleW, 6, pct / 100, rules[i][3])
  })
  y += 50

  // Insights automáticos
  if (data.insights.length) {
    y = ensureSpace(doc, y, 30 + data.insights.length * 16)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Lo que ha cambiado este mes", M, y)
    y += 16
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    data.insights.forEach((insight) => {
      const text = insight.isNew
        ? `${insight.categoria}: nuevo este mes, ${m(insight.current)}.`
        : `${insight.categoria}: ${insight.deltaPct > 0 ? "subió" : "bajó"} un ${Math.round(Math.abs(insight.deltaPct))}% frente a su media (${m(Math.round(insight.average))} → ${m(insight.current)}).`
      doc.setTextColor(...(insight.isNew || insight.deltaPct > 0 ? [217, 119, 6] as [number, number, number] : GREEN))
      doc.text("•", M, y)
      doc.setTextColor(...INK)
      doc.text(text, M + 12, y, { maxWidth: W - M * 2 - 12 })
      y += 16
    })
    y += 8
  }

  // Presupuesto del mes
  if (data.budgets.length) {
    y = ensureSpace(doc, y, 40)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Presupuesto vs real", M, y)
    y += 8
    autoTable(doc, {
      startY: y,
      head: [["Categoría", "Gastado", "Límite", "% usado"]],
      body: data.budgets.map((b) => [b.categoria, m(b.gastado), m(b.limite), `${Math.round((b.gastado / b.limite) * 100)}%`]),
      theme: "striped",
      headStyles: { fillColor: BRAND, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: INK },
      margin: { left: M, right: M },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      didParseCell: (hook) => {
        if (hook.section === "body" && hook.column.index === 3) {
          const pct = parseInt(String(hook.cell.raw), 10)
          hook.cell.styles.textColor = pct >= 100 ? RED : pct >= 80 ? [217, 119, 6] : GREEN
        }
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24
  }

  // Gasto por categoría
  if (data.categoryBreakdown.length) {
    y = ensureSpace(doc, y, 40)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Gasto por categoría", M, y)
    y += 8
    const total = data.categoryBreakdown.reduce((s, c) => s + c.monto, 0) || 1
    autoTable(doc, {
      startY: y,
      head: [["Categoría", "Importe", "%"]],
      body: data.categoryBreakdown.map((c) => [c.categoria, m(c.monto), `${((c.monto / total) * 100).toFixed(1)}%`]),
      theme: "striped",
      headStyles: { fillColor: BRAND, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: INK },
      margin: { left: M, right: M },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    })
  }

  drawFooter(doc, M)
  doc.save(`analiticas-${new Date().toISOString().slice(0, 10)}.pdf`)
}
