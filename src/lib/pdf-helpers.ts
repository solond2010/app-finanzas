import { jsPDF } from "jspdf"

// Azul cobalto real de la app (oklch(0.52 0.17 264), el mismo --primary de globals.css).
export const BRAND: [number, number, number] = [52, 97, 201]
// Dorado de marca (--gold de globals.css), usado como línea de firma bajo la
// cabecera — el mismo acento que hero-panel/login/sidebar en el resto de la app.
export const GOLD: [number, number, number] = [232, 182, 74]
export const INK: [number, number, number] = [17, 24, 39]
export const MUTED: [number, number, number] = [107, 114, 128]
export const GREEN: [number, number, number] = [16, 185, 129]
export const RED: [number, number, number] = [239, 68, 68]
export const TRACK: [number, number, number] = [229, 231, 235]
export const PIE_COLORS = ["rgb(52,97,201)", "#0ea5e9", "#6366f1", "#8b5cf6", "#0891b2", "#64748b", "#10b981", "#f59e0b"]

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
    ctx.fillStyle = "rgb(52,97,201)"
    roundRectPath(ctx, x, y, barW, barH, 3)
    ctx.fill()
    ctx.fillStyle = "#6b7280"
    ctx.font = "9px Helvetica, Arial, sans-serif"
    ctx.fillText(d.label, x + barW / 2, h - 4)
    if (barW > 26) {
      ctx.fillStyle = "#111827"
      ctx.font = "8px Helvetica, Arial, sans-serif"
      ctx.fillText(valueFormatter(d.value), x + barW / 2, y - 4)
    }
  })
  return canvas.toDataURL("image/png")
}

/**
 * Dibuja un gráfico de tarta en un canvas oculto y devuelve su dataURL PNG.
 * Círculo centrado arriba y leyenda a ancho completo debajo (en vez de al
 * lado): con columnas estrechas, una leyenda lateral se corta sin espacio
 * para el texto.
 */
export function renderPieChart(data: { name: string; value: number }[], w: number, h: number): string {
  const scale = 2
  const canvas = document.createElement("canvas")
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext("2d")!
  ctx.scale(scale, scale)
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = Math.min(w, h) * 0.26
  const cx = w / 2, cy = r + 6
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
  const legendTop = cy + r + 12
  const rowH = 12
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  data.forEach((d, i) => {
    const ly = legendTop + i * rowH
    if (ly > h - 4) return
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length]
    ctx.fillRect(6, ly - 4, 8, 8)
    ctx.fillStyle = "#111827"
    ctx.font = "8px Helvetica, Arial, sans-serif"
    const pct = ((d.value / total) * 100).toFixed(1)
    ctx.fillText(`${d.name} (${pct}%)`, 18, ly)
  })
  return canvas.toDataURL("image/png")
}

export function drawTile(doc: jsPDF, x: number, y: number, w: number, h: number, t: Tile) {
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
