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
  value: number
  invested: number
  pnl: number
  pnlPct: number
  byType: { name: string; value: number }[]
  positions: XrayPosition[]
}

const BRAND: [number, number, number] = [59, 91, 219]
const INK: [number, number, number] = [17, 24, 39]
const MUTED: [number, number, number] = [107, 114, 128]
const GREEN: [number, number, number] = [16, 185, 129]
const RED: [number, number, number] = [239, 68, 68]

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
  doc.text("Informe X-Ray de Cartera", M, 42)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
  doc.text(`${data.owner} · Generado el ${today}`, M, 62)

  // Summary cards
  let y = 120
  const cards: { label: string; value: string; color: [number, number, number] }[] = [
    { label: "Valor total", value: m(data.value), color: INK },
    { label: "Invertido", value: m(data.invested), color: INK },
    { label: "Rentabilidad", value: `${signed(data.pnl)} (${data.pnlPct >= 0 ? "+" : ""}${data.pnlPct.toFixed(2)}%)`, color: data.pnl >= 0 ? GREEN : RED },
  ]
  const cardW = (W - M * 2 - 24) / 3
  cards.forEach((c, i) => {
    const x = M + i * (cardW + 12)
    doc.setDrawColor(229, 231, 235)
    doc.setFillColor(249, 250, 251)
    doc.roundedRect(x, y, cardW, 56, 8, 8, "FD")
    doc.setTextColor(...MUTED)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.text(c.label.toUpperCase(), x + 12, y + 20)
    doc.setTextColor(...c.color)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text(c.value, x + 12, y + 40)
  })
  y += 84

  // Composición por tipología
  if (data.byType.length) {
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Composición por tipología", M, y)
    y += 8
    const total = data.byType.reduce((s, t) => s + t.value, 0) || 1
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Valor", "% cartera"]],
      body: data.byType.map((t) => [t.name, m(t.value), `${((t.value / total) * 100).toFixed(1)}%`]),
      theme: "grid",
      headStyles: { fillColor: BRAND, fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: INK },
      margin: { left: M, right: M },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24
  }

  // Posiciones
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

  doc.save(`xray-cartera-${new Date().toISOString().slice(0, 10)}.pdf`)
}
