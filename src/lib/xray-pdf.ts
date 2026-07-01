import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatMoney, type CurrencyCode } from "@/lib/currency"

export interface XrayPosition {
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
  positions: XrayPosition[]
}

const BRAND: [number, number, number] = [59, 91, 219]
const INK: [number, number, number] = [17, 24, 39]
const MUTED: [number, number, number] = [107, 114, 128]
const GREEN: [number, number, number] = [16, 185, 129]
const RED: [number, number, number] = [239, 68, 68]
const TRACK: [number, number, number] = [229, 231, 235]

interface Tile { label: string; value: string; color?: [number, number, number] }

function drawTile(doc: jsPDF, x: number, y: number, w: number, h: number, t: Tile) {
  doc.setDrawColor(...TRACK)
  doc.setFillColor(249, 250, 251)
  doc.roundedRect(x, y, w, h, 8, 8, "FD")
  doc.setTextColor(...MUTED)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(t.label.toUpperCase(), x + 12, y + 20)
  doc.setTextColor(...(t.color ?? INK))
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text(t.value, x + 12, y + 40, { maxWidth: w - 24 })
}

/** Dibuja una cuadrícula de tarjetas y devuelve el nuevo Y tras la cuadrícula. */
function drawTileGrid(doc: jsPDF, x: number, y: number, totalW: number, gap: number, tiles: Tile[], cols: number, tileH: number) {
  const tileW = (totalW - gap * (cols - 1)) / cols
  tiles.forEach((t, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    drawTile(doc, x + col * (tileW + gap), y + row * (tileH + gap), tileW, tileH, t)
  })
  const rows = Math.ceil(tiles.length / cols) || 1
  return y + rows * (tileH + gap)
}

function drawProgressBar(doc: jsPDF, x: number, y: number, w: number, h: number, pct: number, color: [number, number, number]) {
  doc.setFillColor(...TRACK)
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F")
  const fillW = Math.max(h, w * Math.min(1, Math.max(0, pct)))
  doc.setFillColor(...color)
  doc.roundedRect(x, y, fillW, h, h / 2, h / 2, "F")
}

/** Añade página nueva si no queda sitio suficiente antes del pie de página. */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + needed > pageH - 50) {
    doc.addPage()
    return 40
  }
  return y
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

  // Footer
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setTextColor(...MUTED)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.text("Finanzas · Informe generado automáticamente. No constituye asesoramiento financiero.", M, doc.internal.pageSize.getHeight() - 24)
    doc.text(`${i} / ${pages}`, W - M, doc.internal.pageSize.getHeight() - 24, { align: "right" })
  }

  doc.save(`patrimonio-${new Date().toISOString().slice(0, 10)}.pdf`)
}
