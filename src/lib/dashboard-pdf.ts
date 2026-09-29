import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatMoney } from "@/lib/currency"
import { BRAND, GOLD, INK, MUTED, GREEN, RED, TRACK, CARD, drawPageBackground, renderBarChart, renderPieChart, drawProgressBar, drawFooter, pdfText } from "@/lib/pdf-helpers"

interface DashboardPdfAccount { nombre: string; tipo: string; banco: string; saldo: number }
interface DashboardPdfBudgetRow { categoria: string; gastado: number; limite: number }
interface DashboardPdfCategoryRow { categoria: string; monto: number }
interface DashboardPdfGoal { nombre: string; actual: number; objetivo: number; fecha: string }
interface DashboardPdfTransactionRow { fecha: string; descripcion: string; categoria: string; tipo: "ingreso" | "gasto"; monto: number }

export interface DashboardPdfData {
  owner: string
  month: string
  netWorth: number
  netWorthTarget: number
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
  investmentValue: number
  investmentInvested: number
  investmentPnl: number
  accountComposition: { name: string; value: number }[]
  accounts: DashboardPdfAccount[]
  goals: DashboardPdfGoal[]
  budgets: DashboardPdfBudgetRow[]
  spending: DashboardPdfCategoryRow[]
  transactions: DashboardPdfTransactionRow[]
}

function panel(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...CARD)
  doc.setDrawColor(...TRACK)
  doc.setLineWidth(0.65)
  doc.roundedRect(x, y, w, h, 10, 10, "FD")
}

function sectionTitle(doc: jsPDF, title: string, x: number, y: number) {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(title.toUpperCase(), x, y)
}

function addHeader(doc: jsPDF, month: string, pageLabel: string) {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...GOLD)
  doc.roundedRect(40, 26, 3, 22, 1.5, 1.5, "F")
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("FINANZAS", 51, 36)
  doc.setTextColor(...MUTED)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(pdfText(pageLabel).toUpperCase(), 51, 48)
  doc.setTextColor(...GOLD)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text(pdfText(month).toUpperCase(), W - 40, 39, { align: "right" })
  doc.setDrawColor(...TRACK)
  doc.line(40, 59, W - 40, 59)
}

function drawMetric(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, color: [number, number, number]) {
  panel(doc, x, y, w, 58)
  sectionTitle(doc, label, x + 12, y + 17)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.setTextColor(...color)
  let size = 15
  while (size > 8 && doc.getTextWidth(value) > w - 24) { size--; doc.setFontSize(size) }
  doc.text(value, x + 12, y + 42)
}

export function generateDashboardPdf(data: DashboardPdfData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  drawPageBackground(doc)
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const GAP = 12
  const m = (v: number) => pdfText(formatMoney(v, "EUR"))
  const signed = (v: number) => `${v >= 0 ? "+" : "-"}${m(Math.abs(v))}`
  // Página 1: resumen de un vistazo con la misma jerarquía del Dashboard.
  addHeader(doc, data.month, `Informe mensual · ${data.owner}`)
  const heroY = 74
  const heroW = W - M * 2
  panel(doc, M, heroY, heroW, 91)
  sectionTitle(doc, "Patrimonio total", M + 18, heroY + 23)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(29)
  doc.setTextColor(...GOLD)
  let heroSize = 29
  while (heroSize > 18 && doc.getTextWidth(m(data.netWorth)) > heroW * 0.54) { heroSize--; doc.setFontSize(heroSize) }
  doc.text(m(data.netWorth), M + 18, heroY + 58)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(`Salud financiera ${data.score}/100 · ${data.scoreLabel}`, M + 20, heroY + 77)

  const targetX = M + heroW * 0.61
  const targetW = heroW * 0.35
  if (data.netWorthTarget > 0) {
    sectionTitle(doc, "Objetivo de patrimonio", targetX, heroY + 23)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(...INK)
    doc.text(m(data.netWorthTarget), targetX, heroY + 45)
    const pct = data.netWorth / data.netWorthTarget
    drawProgressBar(doc, targetX, heroY + 56, targetW, 7, pct, GOLD)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`${Math.round(pct * 100)}% completado`, targetX, heroY + 77)
  } else {
    sectionTitle(doc, "Salud financiera", targetX, heroY + 23)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(...GOLD)
    doc.text(`${data.score}/100 · ${data.scoreLabel}`, targetX, heroY + 48)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text("Puntuación de flujo y hábitos", targetX, heroY + 70)
  }

  const metricY = 178
  const metricW = (heroW - GAP * 3) / 4
  drawMetric(doc, M, metricY, metricW, "Ingresos del mes", signed(data.ingresos), GREEN)
  drawMetric(doc, M + metricW + GAP, metricY, metricW, "Gastos del mes", signed(-data.gastos), RED)
  drawMetric(doc, M + (metricW + GAP) * 2, metricY, metricW, "Ahorro neto", signed(data.ingresos - data.gastos), data.ingresos >= data.gastos ? GREEN : RED)
  drawMetric(doc, M + (metricW + GAP) * 3, metricY, metricW, "Tasa de ahorro", `${Math.round(data.savingsRate)}%`, GOLD)

  const chartY = 250
  const chartH = 207
  const chartGap = 14
  const chartW = (heroW - chartGap) / 2
  panel(doc, M, chartY, chartW, chartH)
  panel(doc, M + chartW + chartGap, chartY, chartW, chartH)
  sectionTitle(doc, `Evolución del patrimonio · ${data.rangeLabel}`, M + 14, chartY + 20)
  sectionTitle(doc, "Composición del patrimonio", M + chartW + chartGap + 14, chartY + 20)
  const trend = data.netWorthTrend.slice(-18)
  if (trend.length > 1) {
    const chart = renderBarChart(trend.map((p) => ({ label: p.label, value: p.value })), chartW - 28, chartH - 44, m)
    doc.addImage(chart, "PNG", M + 14, chartY + 31, chartW - 28, chartH - 44)
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED)
    doc.text("Aún no hay suficiente historial para mostrar la evolución.", M + 16, chartY + 58)
  }
  const composition = data.accountComposition.filter((item) => item.value > 0).slice(0, 7)
  if (composition.length) {
    const pie = renderPieChart(composition, chartW - 28, chartH - 44)
    doc.addImage(pie, "PNG", M + chartW + chartGap + 14, chartY + 31, chartW - 28, chartH - 44)
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED)
    doc.text("Añade cuentas para ver la distribución del patrimonio.", M + chartW + chartGap + 16, chartY + 58)
  }

  const bottomY = 469
  const bottomH = 71
  panel(doc, M, bottomY, chartW, bottomH)
  sectionTitle(doc, "Cartera de inversión", M + 14, bottomY + 18)
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...INK)
  doc.text(m(data.investmentValue), M + 14, bottomY + 40)
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED)
  doc.text(`Invertido ${m(data.investmentInvested)}   ·   Resultado ${signed(data.investmentPnl)}`, M + 14, bottomY + 57)
  panel(doc, M + chartW + chartGap, bottomY, chartW, bottomH)
  sectionTitle(doc, "Metas de ahorro", M + chartW + chartGap + 14, bottomY + 18)
  const goals = data.goals.slice(0, 3)
  if (goals.length) {
    const cellW = (chartW - 36) / goals.length
    goals.forEach((goal, i) => {
      const x = M + chartW + chartGap + 14 + cellW * i
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...INK)
      doc.text(pdfText(goal.nombre), x, bottomY + 36, { maxWidth: cellW - 9 })
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED)
      doc.text(`${Math.round(goal.objetivo > 0 ? goal.actual / goal.objetivo * 100 : 0)}% · ${m(goal.actual)} / ${m(goal.objetivo)}`, x, bottomY + 52)
      const deadline = new Date(`${goal.fecha}T12:00:00`)
      doc.setFontSize(6)
      doc.text(Number.isNaN(deadline.getTime()) ? "Sin fecha objetivo" : `Fecha objetivo · ${deadline.toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`, x, bottomY + 63, { maxWidth: cellW - 9 })
    })
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED)
    doc.text("Todavía no hay metas de ahorro configuradas.", M + chartW + chartGap + 14, bottomY + 43)
  }

  // Página 2: datos operativos del mes, incluyendo el detalle de movimientos.
  doc.addPage()
  drawPageBackground(doc)
  addHeader(doc, data.month, "Detalle del mes")
  const statY = 74
  const statW = (heroW - GAP * 3) / 4
  drawMetric(doc, M, statY, statW, "Cuentas incluidas", String(data.accounts.length), GOLD)
  drawMetric(doc, M + statW + GAP, statY, statW, "Presupuestos", String(data.budgets.length), GOLD)
  drawMetric(doc, M + (statW + GAP) * 2, statY, statW, "Movimientos", String(data.transactions.length), GOLD)
  drawMetric(doc, M + (statW + GAP) * 3, statY, statW, `Acumulado ${data.year}`, signed(data.annualNeto), data.annualNeto >= 0 ? GREEN : RED)

  const topY = 146
  const halfW = (heroW - 14) / 2
  const maxRows = 5
  panel(doc, M, topY, halfW, 128)
  panel(doc, M + halfW + 14, topY, halfW, 128)
  sectionTitle(doc, "Cuentas", M + 14, topY + 20)
  sectionTitle(doc, "Presupuesto por categoría", M + halfW + 28, topY + 20)
  const drawList = (rows: { label: string; value: string; color?: [number, number, number] }[], x: number) => {
    rows.slice(0, maxRows).forEach((row, i) => {
      const yy = topY + 41 + i * 16
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED)
      doc.text(pdfText(row.label), x + 14, yy, { maxWidth: halfW * 0.55 })
      doc.setFont("helvetica", "bold"); doc.setTextColor(...(row.color ?? INK))
      doc.text(row.value, x + halfW - 14, yy, { align: "right" })
    })
  }
  drawList(data.accounts.map((a) => ({ label: `${a.nombre} · ${a.tipo}`, value: m(a.saldo), color: a.saldo < 0 ? RED : INK })), M)
  drawList(data.budgets.map((b) => ({ label: b.categoria, value: `${m(b.gastado)} / ${m(b.limite)}`, color: b.gastado > b.limite ? RED : INK })), M + halfW + 14)

  const tableY = topY + 143
  sectionTitle(doc, `Movimientos registrados en ${data.month}`, M, tableY)
  autoTable(doc, {
    startY: tableY + 12,
    willDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) {
        drawPageBackground(doc)
        addHeader(doc, data.month, "Detalle del mes · continuación")
      }
    },
    head: [["Fecha", "Descripción", "Categoría", "Tipo", "Importe"]],
    body: data.transactions.map((t) => [
      new Date(`${t.fecha}T12:00:00`).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      pdfText(t.descripcion || "—"),
      pdfText(t.categoria),
      t.tipo === "ingreso" ? "Ingreso" : "Gasto",
      `${t.tipo === "ingreso" ? "+" : "-"}${m(t.monto)}`,
    ]),
    theme: "plain",
    headStyles: { fillColor: CARD, textColor: GOLD, fontSize: 8, lineColor: TRACK },
    bodyStyles: { fontSize: 8, textColor: INK, fillColor: BRAND, lineColor: TRACK, cellPadding: 5 },
    alternateRowStyles: { fillColor: CARD },
    margin: { left: M, right: M, top: 78, bottom: 42 },
    columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 250 }, 2: { cellWidth: 150 }, 3: { cellWidth: 74 }, 4: { halign: "right" } },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.index === 4) hook.cell.styles.textColor = String(hook.cell.raw).startsWith("-") ? RED : GREEN
    },
  })

  drawFooter(doc, M)
  doc.save(`finanzas-${data.month.toLowerCase().replaceAll(" ", "-")}.pdf`)
}
