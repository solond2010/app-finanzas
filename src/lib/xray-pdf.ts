import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatMoney, type CurrencyCode } from "@/lib/currency"
import { BRAND, GOLD, INK, MUTED, GREEN, RED, TRACK, type Tile, renderBarChart, renderPieChart, drawTile, drawTileGrid, drawProgressBar, ensureSpace, drawFooter } from "@/lib/pdf-helpers"

interface XrayPosition {
  name: string
  kind: string
  account: string
  units: number
  buyPrice: number
  current: number
  value: number
  pl: number
  plPct: number
}

export interface XrayData {
  owner: string
  currency: CurrencyCode
  /** Mes del snapshot, p. ej. "julio de 2026". */
  month: string
  /** Patrimonio total: cuentas (liquidez) + cartera de inversión. */
  netWorth: number
  /** Objetivo de patrimonio (0 = sin objetivo definido). */
  netWorthTarget: number
  ingresos: number
  gastos: number
  /** Dinero movido este mes hacia cuentas de inversión (traspasos). */
  investmentInflow: number
  value: number
  invested: number
  pnl: number
  pnlPct: number
  /** Desglose por clase de activo, incluye liquidez de cuentas. */
  byType: { name: string; value: number }[]
  /** Patrimonio histórico mensual (más reciente al final) para el gráfico de evolución. */
  netWorthTrend: { label: string; value: number }[]
  positions: XrayPosition[]
}

export function generateXrayPdf(data: XrayData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const m = (v: number) => formatMoney(v, data.currency)
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${formatMoney(Math.abs(v), data.currency)}`

  // Header band
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, W, 90, "F")
  doc.setFillColor(...GOLD)
  doc.rect(0, 90, W, 3, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.text("Informe Patrimonial", M, 42)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
  doc.text(`${data.owner} · ${data.month} · Generado el ${today}`, M, 62)

  let y = 120

  // Patrimonio total + objetivo
  const netWorthW = data.netWorthTarget > 0 ? (W - M * 2 - 16) * 0.58 : W - M * 2
  drawTile(doc, M, y, netWorthW, 70, { label: "Patrimonio total", value: m(data.netWorth) })
  if (data.netWorthTarget > 0) {
    const objX = M + netWorthW + 16
    const objW = W - M * 2 - netWorthW - 16
    doc.setDrawColor(...TRACK)
    doc.setFillColor(249, 250, 251)
    doc.roundedRect(objX, y, objW, 70, 8, 8, "FD")
    doc.setTextColor(...MUTED)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.text("OBJETIVO", objX + 12, y + 18)
    const pct = data.netWorth / data.netWorthTarget
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text(`${m(data.netWorthTarget)} · ${Math.round(pct * 100)}%`, objX + 12, y + 34)
    drawProgressBar(doc, objX + 12, y + 46, objW - 24, 10, pct, BRAND)
  }
  y += 70 + 24

  // Ingresos / Gastos / Inversión del mes
  y = ensureSpace(doc, y, 30 + 70)
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text(`Movimientos de ${data.month}`, M, y)
  y += 14
  y = drawTileGrid(doc, M, y, W - M * 2, 12, [
    { label: "Ingresos", value: signed(data.ingresos), color: GREEN },
    { label: "Gastos", value: signed(-data.gastos), color: RED },
    { label: "Invertido", value: m(data.investmentInflow), color: BRAND },
  ], 3, 60)
  y += 24

  // Composición por clase de activo
  if (data.byType.length) {
    y = ensureSpace(doc, y, 30 + 70)
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Composición por clase de activo", M, y)
    y += 14
    const total = data.byType.reduce((s, t) => s + t.value, 0) || 1
    const classTiles: Tile[] = data.byType.map((t) => ({
      label: t.name,
      value: `${m(t.value)}  (${((t.value / total) * 100).toFixed(1)}%)`,
    }))
    const cols = 3
    const rows = Math.ceil(classTiles.length / cols)
    y = ensureSpace(doc, y, rows * (60 + 12))
    y = drawTileGrid(doc, M, y, W - M * 2, 12, classTiles, cols, 60)
    y += 12
  }

  // Evolución del patrimonio + Distribución por clase de activo (gráficos)
  if (data.netWorthTrend.length > 1 || data.byType.length > 0) {
    const chartH = 150
    y = ensureSpace(doc, y, 30 + chartH)
    const hasTrend = data.netWorthTrend.length > 1
    const hasPie = data.byType.length > 0
    const gap = 16
    const trendW = hasPie ? (W - M * 2 - gap) * 0.6 : W - M * 2
    const pieW = W - M * 2 - trendW - gap
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    if (hasTrend) doc.text("Evolución del patrimonio", M, y)
    if (hasPie) doc.text("Distribución", M + (hasTrend ? trendW + gap : 0), y)
    const chartY = y + 10
    if (hasTrend) {
      const img = renderBarChart(data.netWorthTrend, trendW, chartH, m)
      doc.addImage(img, "PNG", M, chartY, trendW, chartH)
    }
    if (hasPie) {
      const img = renderPieChart(data.byType, pieW, chartH)
      doc.addImage(img, "PNG", M + (hasTrend ? trendW + gap : 0), chartY, pieW, chartH)
    }
    y = chartY + chartH + 24
  }

  // Rentabilidad de la cartera de inversión
  y = ensureSpace(doc, y, 30 + 60)
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("Cartera de inversión", M, y)
  y += 14
  y = drawTileGrid(doc, M, y, W - M * 2, 12, [
    { label: "Valor cartera", value: m(data.value) },
    { label: "Invertido", value: m(data.invested) },
    { label: "Rentabilidad", value: `${signed(data.pnl)} (${data.pnlPct >= 0 ? "+" : ""}${data.pnlPct.toFixed(2)}%)`, color: data.pnl >= 0 ? GREEN : RED },
  ], 3, 60)
  y += 24

  // Posiciones
  y = ensureSpace(doc, y, 40)
  doc.setTextColor(...INK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("Posiciones", M, y)
  y += 8
  autoTable(doc, {
    startY: y,
    head: [["Activo", "Cuenta", "Uds.", "P. medio", "P. actual", "Valor", "P&L", "%"]],
    body: data.positions.map((p) => [
      p.name,
      p.account,
      String(p.units),
      m(p.buyPrice),
      m(p.current),
      m(p.value),
      signed(p.pl),
      `${p.plPct >= 0 ? "+" : ""}${p.plPct.toFixed(1)}%`,
    ]),
    theme: "striped",
    headStyles: { fillColor: BRAND, fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: INK },
    margin: { left: M, right: M },
    columnStyles: {
      2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" },
      5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" },
    },
    didParseCell: (hook) => {
      if (hook.section === "body" && (hook.column.index === 6 || hook.column.index === 7)) {
        const neg = String(hook.cell.raw).includes("−") || String(hook.cell.raw).startsWith("-")
        hook.cell.styles.textColor = neg ? RED : GREEN
      }
    },
  })

  drawFooter(doc, M)
  doc.save(`patrimonio-${new Date().toISOString().slice(0, 10)}.pdf`)
}
