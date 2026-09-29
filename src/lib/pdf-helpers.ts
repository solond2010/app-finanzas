import { jsPDF } from "jspdf"

// Paleta compartida de los informes PDF: midnight navy, tarjetas elevadas,
// champagne, verde menta y coral, igual que el tema oscuro de la web.
export const BRAND: [number, number, number] = [8, 19, 34]
export const GOLD: [number, number, number] = [239, 199, 128]
export const INK: [number, number, number] = [241, 244, 249]
export const MUTED: [number, number, number] = [151, 164, 182]
export const GREEN: [number, number, number] = [74, 198, 155]
export const RED: [number, number, number] = [238, 116, 109]
export const TRACK: [number, number, number] = [43, 59, 77]
export const CARD: [number, number, number] = [15, 30, 46]
const PIE_COLORS = ["rgb(239,199,128)", "#4db99f", "#f08079", "#7793c7", "#a995d0", "#56a8c0", "#79a982", "#e6a754"]

/** jsPDF's built-in Helvetica is WinAnsi; normalize separators and strip pictographs. */
export function pdfText(value: string): string {
  return value
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/[\u2190-\u21ff]/g, " a ")
    .replace(/[\u200b-\u200f\uFE0E\uFE0F]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s{2,}/g, " ")
}

export function drawPageBackground(doc: jsPDF) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), "F")
}

export interface Tile { label: string; value: string; color?: [number, number, number] }

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

/** Dibuja un gráfico de barras en un canvas oculto y devuelve su dataURL PNG. */
export function renderBarChart(data: { label: string; value: number }[], w: number, h: number, valueFormatter: (v: number) => string): string {
  const scale = 2
  const canvas = document.createElement("canvas")
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext("2d")!
  ctx.scale(scale, scale)
  ctx.fillStyle = `rgb(${BRAND.join(",")})`
  ctx.fillRect(0, 0, w, h)
  const max = Math.max(...data.map((d) => d.value), 1)
  const padTop = 18, padBottom = 16
  const chartH = h - padTop - padBottom
  const gap = 6
  const barW = (w - gap * (data.length - 1)) / data.length
  ctx.textAlign = "center"
  data.forEach((d, i) => {
    const barH = Math.max(2, (d.value / max) * chartH)
    const x = i * (barW + gap)
    const y = padTop + (chartH - barH)
    ctx.fillStyle = `rgb(${GOLD.join(",")})`
    roundRectPath(ctx, x, y, barW, barH, 3)
    ctx.fill()
    ctx.fillStyle = "#aab7c9"
    ctx.font = "9px Helvetica, Arial, sans-serif"
    ctx.fillText(d.label, x + barW / 2, h - 4)
    if (barW > 26) {
      ctx.fillStyle = "#f1f4f9"
      ctx.font = "8px Helvetica, Arial, sans-serif"
      ctx.fillText(valueFormatter(d.value), x + barW / 2, y - 4)
    }
  })
  return canvas.toDataURL("image/png")
}

/** Gráfico de composición con tarta amplia y leyenda legible en columna. */
export function renderPieChart(data: { name: string; value: number }[], w: number, h: number): string {
  const scale = 2
  const canvas = document.createElement("canvas")
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext("2d")!
  ctx.scale(scale, scale)
  ctx.fillStyle = `rgb(${CARD.join(",")})`
  ctx.fillRect(0, 0, w, h)
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = Math.min(h * 0.39, w * 0.22)
  const cx = Math.max(r + 8, w * 0.27), cy = h / 2
  let angle = -Math.PI / 2
  data.forEach((d, i) => {
    const slice = (d.value / total) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, angle, angle + slice)
    ctx.closePath()
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length]
    ctx.fill()
    angle += slice
  })
  const legendTop = Math.max(10, (h - data.length * 18) / 2 + 9)
  const rowH = Math.min(18, (h - 12) / Math.max(data.length, 1))
  const legendX = Math.min(w - 116, cx + r + 15)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  data.forEach((d, i) => {
    const ly = legendTop + i * rowH
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length]
    ctx.beginPath()
    ctx.arc(legendX + 4, ly, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#f1f4f9"
    ctx.font = "10px Helvetica, Arial, sans-serif"
    const pct = ((d.value / total) * 100).toFixed(1)
    ctx.fillText(`${pdfText(d.name)} · ${pct}%`, legendX + 13, ly, w - legendX - 17)
  })
  return canvas.toDataURL("image/png")
}

export function drawTile(doc: jsPDF, x: number, y: number, w: number, h: number, t: Tile) {
  doc.setDrawColor(...TRACK)
  doc.setFillColor(...CARD)
  doc.roundedRect(x, y, w, h, 8, 8, "FD")
  doc.setTextColor(...MUTED)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(t.label.toUpperCase(), x + 12, y + 20)
  doc.setTextColor(...(t.color ?? INK))
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  let size = 13
  while (size > 8 && doc.getTextWidth(t.value) > w - 24) { size--; doc.setFontSize(size) }
  doc.text(t.value, x + 12, y + 40)
}

/** Dibuja una cuadrícula de tarjetas y devuelve el nuevo Y tras la cuadrícula. */
export function drawTileGrid(doc: jsPDF, x: number, y: number, totalW: number, gap: number, tiles: Tile[], cols: number, tileH: number) {
  const tileW = (totalW - gap * (cols - 1)) / cols
  tiles.forEach((t, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    drawTile(doc, x + col * (tileW + gap), y + row * (tileH + gap), tileW, tileH, t)
  })
  const rows = Math.ceil(tiles.length / cols) || 1
  return y + rows * (tileH + gap)
}

export function drawProgressBar(doc: jsPDF, x: number, y: number, w: number, h: number, pct: number, color: [number, number, number]) {
  doc.setFillColor(...TRACK)
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F")
  const fillW = Math.max(h, w * Math.min(1, Math.max(0, pct)))
  doc.setFillColor(...color)
  doc.roundedRect(x, y, fillW, h, h / 2, h / 2, "F")
}

/** Añade página nueva si no queda sitio suficiente antes del pie de página. */
export function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + needed > pageH - 50) {
    doc.addPage()
    drawPageBackground(doc)
    return 40
  }
  return y
}

/** Pie de página estándar (marca + número de página) en todas las páginas del documento. */
export function drawFooter(doc: jsPDF, margin: number) {
  const W = doc.internal.pageSize.getWidth()
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setTextColor(...MUTED)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.text("Finanzas · Informe generado automáticamente. No constituye asesoramiento financiero.", margin, doc.internal.pageSize.getHeight() - 24)
    doc.text(`${i} / ${pages}`, W - margin, doc.internal.pageSize.getHeight() - 24, { align: "right" })
  }
}
