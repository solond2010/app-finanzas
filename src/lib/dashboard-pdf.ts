import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatMoney } from "@/lib/currency"
import { BRAND, INK, MUTED, GREEN, RED, TRACK, renderBarChart, drawTile, drawTileGrid, ensureSpace, drawFooter } from "@/lib/pdf-helpers"

export interface DashboardPdfAccount {
  nombre: string
  tipo: string
  banco: string
  saldo: number
}

export interface DashboardPdfBudgetRow {
  categoria: string
  gastado: number
  limite: number
}

export interface DashboardPdfCategoryRow {
  categoria: string
  monto: number
}

export interface DashboardPdfTransactionRow {
  fecha: string
  descripcion: string
  categoria: string
  tipo: "ingreso" | "gasto"
  monto: number
}

export interface DashboardPdfData {
  owner: string
  month: string
  netWorth: number
  netWorthTrend: { label: string; value: number }[]
  rangeLabel: string
  score: number
  scoreLabel: string
  scoreFactors: { label: string; ok: boolean }[]
  ingresos: number
  gastos: number
  savingsRate: number
  annualIngresos: number
  annualGastos: number
  annualNeto: number
  year: number
  accounts: DashboardPdfAccount[]
  budgets: DashboardPdfBudgetRow[]
  spending: DashboardPdfCategoryRow[]
  transactions: DashboardPdfTransactionRow[]
}

export function generateDashboardPdf(data: DashboardPdfData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const m = (v: number) => formatMoney(v, "EUR")
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${formatMoney(Math.abs(v), "EUR")}`

  // Header band
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, W, 90, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.text("Informe del Dashboard", M, 42)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
  doc.text(`${data.owner} · ${data.month} · Generado el ${today}`, M, 62)

  let y = 120

  // Patrimonio total + puntuación financiera
  const netWorthW = (W - M * 2 - 16) * 0.58
  drawTile(doc, M, y, netWorthW, 70, { label: "Patrimonio total", value: m(data.netWorth) })
  const scoreX = M + netWorthW + 16
  const scoreW = W - M * 2 - netWorthW - 16
  doc.setDrawColor(...TRACK)
  doc.setFillColor(249, 250, 251)
  doc.roundedRect(scoreX, y, scoreW, 70, 8, 8, "FD")
  doc.setTextColor(...MUTED)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text("PUNTUACIÓN FINANCIERA", scoreX + 12, y + 18)
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text(`${data.score}/100 · ${data.scoreLabel}`, scoreX + 12, y + 40)
  y += 70 + 24

  // Factores de la puntuación
  y = ensureSpace(doc, y, 20 + data.scoreFactors.length * 14)
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Factores evaluados", M, y)
  y += 16
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  data.scoreFactors.forEach((f) => {
    doc.setTextColor(...(f.ok ? GREEN : MUTED))
    doc.text(f.ok ? "✓" : "·", M, y)
    doc.setTextColor(...INK)
    doc.text(f.label, M + 14, y)
    y += 14
  })
  y += 10

  // KPIs del mes
  y = ensureSpace(doc, y, 30 + 60)
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text(`Movimientos de ${data.month}`, M, y)
  y += 14
  y = drawTileGrid(doc, M, y, W - M * 2, 12, [
    { label: "Ingresos", value: signed(data.ingresos), color: GREEN },
    { label: "Gastos", value: signed(-data.gastos), color: RED },
    { label: "Tasa de ahorro", value: `${data.savingsRate}%`, color: BRAND },
  ], 3, 60)
  y += 24

  // Acumulado anual
  y = ensureSpace(doc, y, 30 + 60)
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text(`Acumulado ${data.year}`, M, y)
  y += 14
  y = drawTileGrid(doc, M, y, W - M * 2, 12, [
    { label: "Ingresos totales", value: m(data.annualIngresos), color: GREEN },
    { label: "Gastos totales", value: m(data.annualGastos), color: RED },
    { label: "Ahorro neto anual", value: signed(data.annualNeto), color: data.annualNeto >= 0 ? GREEN : RED },
  ], 3, 60)
  y += 24

  // Evolución del patrimonio (gráfico de barras)
  if (data.netWorthTrend.length > 1) {
    const chartH = 140
    y = ensureSpace(doc, y, 30 + chartH)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text(`Evolución del patrimonio (${data.rangeLabel})`, M, y)
    const chartY = y + 10
    const img = renderBarChart(data.netWorthTrend, W - M * 2, chartH, m)
    doc.addImage(img, "PNG", M, chartY, W - M * 2, chartH)
    y = chartY + chartH + 24
  }

  // Cuentas
  if (data.accounts.length) {
    y = ensureSpace(doc, y, 40)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Mis cuentas", M, y)
    y += 8
    autoTable(doc, {
      startY: y,
      head: [["Cuenta", "Tipo", "Banco", "Saldo"]],
      body: data.accounts.map((a) => [a.nombre, a.tipo, a.banco || "—", m(a.saldo)]),
      theme: "striped",
      headStyles: { fillColor: BRAND, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: INK },
      margin: { left: M, right: M },
      columnStyles: { 3: { halign: "right" } },
      didParseCell: (hook) => {
        if (hook.section === "body" && hook.column.index === 3) {
          const neg = String(hook.cell.raw).includes("−") || String(hook.cell.raw).startsWith("-")
          hook.cell.styles.textColor = neg ? RED : INK
        }
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24
  }

  // Presupuesto del mes
  if (data.budgets.length) {
    y = ensureSpace(doc, y, 40)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Presupuesto del mes", M, y)
    y += 8
    autoTable(doc, {
      startY: y,
      head: [["Categoría", "Gastado", "Límite", "% usado"]],
      body: data.budgets.map((b) => [
        b.categoria,
        m(b.gastado),
        m(b.limite),
        `${Math.round((b.gastado / b.limite) * 100)}%`,
      ]),
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

  // Distribución de gastos por categoría
  if (data.spending.length) {
    y = ensureSpace(doc, y, 40)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Distribución de gastos", M, y)
    y += 8
    const total = data.spending.reduce((s, c) => s + c.monto, 0) || 1
    autoTable(doc, {
      startY: y,
      head: [["Categoría", "Importe", "%"]],
      body: data.spending.map((c) => [c.categoria, m(c.monto), `${((c.monto / total) * 100).toFixed(1)}%`]),
      theme: "striped",
      headStyles: { fillColor: BRAND, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: INK },
      margin: { left: M, right: M },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24
  }

  // Transacciones del mes
  if (data.transactions.length) {
    y = ensureSpace(doc, y, 40)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text(`Transacciones de ${data.month}`, M, y)
    y += 8
    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Descripción", "Categoría", "Monto"]],
      body: data.transactions.map((t) => [
        t.fecha,
        t.descripcion,
        t.categoria,
        `${t.tipo === "ingreso" ? "+" : "-"}${m(t.monto)}`,
      ]),
      theme: "striped",
      headStyles: { fillColor: BRAND, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: INK },
      margin: { left: M, right: M },
      columnStyles: { 3: { halign: "right" } },
      didParseCell: (hook) => {
        if (hook.section === "body" && hook.column.index === 3) {
          const neg = String(hook.cell.raw).startsWith("-")
          hook.cell.styles.textColor = neg ? RED : GREEN
        }
      },
    })
  }

  drawFooter(doc, M)
  doc.save(`dashboard-${new Date().toISOString().slice(0, 10)}.pdf`)
}
