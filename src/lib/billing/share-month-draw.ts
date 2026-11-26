// Dibuja la imagen de «Mi mes» en un canvas 1080×1350.
// Diseño propio de Garra (noche + naranja de marca). No depende de datos reales.

import type { ShareMonthView } from "./share-month"

export const SHARE_MONTH_WIDTH = 1080
export const SHARE_MONTH_HEIGHT = 1350
export const SHARE_MONTH_BG = "#0B0F14"
const INK = "#F3F1EA"
const MUTED = "#9AA3B2"
const GOLD = "#F5A524"
const CARD = "#151B23"
const LINE = "#2A3340"
const GREEN = "#2BD9A0"
const RED = "#FF6B5B"
const GOLD_DIM = "#C98A1E"

type Ctx = CanvasRenderingContext2D

export type ShareMonthFonts = { heading: string; sans: string }

const DEFAULT_FONTS: ShareMonthFonts = {
  heading: '"Bricolage Grotesque", Inter, system-ui, sans-serif',
  sans: "Inter, system-ui, sans-serif",
}

function font(ctx: Ctx, family: string, size: number, weight = "400") {
  ctx.font = `${weight} ${size}px ${family}`
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fillRound(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
}

function strokeRound(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string, width = 1.5) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  roundRect(ctx, x, y, w, h, r)
  ctx.stroke()
}

function text(ctx: Ctx, value: string, x: number, y: number, color: string, align: CanvasTextAlign = "left") {
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = "alphabetic"
  ctx.fillText(value, x, y)
}

function ellipsize(ctx: Ctx, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value
  let cut = value
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut}…`
}

function drawGarraMark(ctx: Ctx, x: number, y: number, size: number) {
  const s = size / 32
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  roundRect(ctx, 0, 0, 32, 32, 7.5)
  ctx.fillStyle = GOLD
  ctx.fill()
  ctx.fillStyle = SHARE_MONTH_BG
  ctx.beginPath()
  ctx.moveTo(8, 25)
  ctx.lineTo(12, 25)
  ctx.lineTo(15.5, 12)
  ctx.lineTo(13.5, 11)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(14, 25)
  ctx.lineTo(18, 25)
  ctx.lineTo(22, 8.5)
  ctx.lineTo(20, 7.5)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.moveTo(20, 25)
  ctx.lineTo(24, 25)
  ctx.lineTo(26.5, 14.5)
  ctx.lineTo(24.5, 13.5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawLineChart(ctx: Ctx, view: ShareMonthView, x: number, y: number, w: number, h: number, fonts: ShareMonthFonts) {
  const pts = view.history
  if (pts.length === 0) return
  const values = pts.flatMap((p) => [p.income, p.expenses])
  const max = Math.max(...values, 1)
  const min = 0
  const plotH = h - 36
  const step = pts.length > 1 ? w / (pts.length - 1) : w
  const at = (value: number, index: number) => ({
    x: x + index * step,
    y: y + plotH - ((value - min) / (max - min)) * plotH,
  })

  ctx.save()
  // faint horizontal guides
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  for (let i = 0; i < 3; i++) {
    const gy = y + (plotH / 2) * i
    ctx.beginPath()
    ctx.moveTo(x, gy)
    ctx.lineTo(x + w, gy)
    ctx.stroke()
  }

  const strokeSeries = (key: "income" | "expenses", color: string, width: number) => {
    ctx.beginPath()
    pts.forEach((p, i) => {
      const pt = at(p[key], i)
      if (i === 0) ctx.moveTo(pt.x, pt.y)
      else ctx.lineTo(pt.x, pt.y)
    })
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    ctx.stroke()
  }

  // soft fill under income line
  ctx.beginPath()
  pts.forEach((p, i) => {
    const pt = at(p.income, i)
    if (i === 0) ctx.moveTo(pt.x, pt.y)
    else ctx.lineTo(pt.x, pt.y)
  })
  ctx.lineTo(x + w, y + plotH)
  ctx.lineTo(x, y + plotH)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, y, 0, y + plotH)
  grad.addColorStop(0, "rgba(245,165,36,0.28)")
  grad.addColorStop(1, "rgba(245,165,36,0)")
  ctx.fillStyle = grad
  ctx.fill()

  strokeSeries("expenses", RED, 3.5)
  strokeSeries("income", GOLD, 4.5)

  // end dots
  const lastI = at(pts[pts.length - 1]!.income, pts.length - 1)
  const lastE = at(pts[pts.length - 1]!.expenses, pts.length - 1)
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.arc(lastI.x, lastI.y, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = RED
  ctx.beginPath()
  ctx.arc(lastE.x, lastE.y, 5, 0, Math.PI * 2)
  ctx.fill()

  font(ctx, fonts.sans, 20, "500")
  pts.forEach((p, i) => {
    const px = x + i * step
    text(ctx, p.label, px, y + h - 4, i === pts.length - 1 ? GOLD : MUTED, "center")
  })
  ctx.restore()
}

function drawSources(ctx: Ctx, view: ShareMonthView, x: number, y: number, w: number, fonts: ShareMonthFonts): number {
  const tones = [GOLD, GOLD_DIM, "#E8C078", "#8C6A2A", "#5C4A28"]
  font(ctx, fonts.heading, 24, "600")
  text(ctx, "De dónde vienen los ingresos", x, y, INK)
  const barY = y + 20
  const barH = 22
  fillRound(ctx, x, barY, w, barH, 11, LINE)
  const total = view.sources.reduce((s, row) => s + row.weight, 0)
  let cursor = x
  if (total > 0 && view.sources.length > 0) {
    view.sources.forEach((row, i) => {
      const rw = Math.max(8, (row.weight / total) * w)
      const isLast = i === view.sources.length - 1
      const width = isLast ? x + w - cursor : Math.min(rw, x + w - cursor)
      ctx.save()
      ctx.beginPath()
      roundRect(ctx, x, barY, w, barH, 11)
      ctx.clip()
      ctx.fillStyle = tones[i % tones.length]!
      ctx.fillRect(cursor, barY, width, barH)
      ctx.restore()
      cursor += width
    })
  } else {
    font(ctx, fonts.sans, 22, "400")
    text(ctx, "Sin ingresos en este mes", x, barY + 52, MUTED)
    return barY + 70
  }

  // Leyenda en una sola franja, no una lista vertical.
  let sx = x
  const sy = barY + barH + 36
  view.sources.forEach((row, i) => {
    ctx.fillStyle = tones[i % tones.length]!
    ctx.beginPath()
    ctx.arc(sx + 7, sy - 6, 6, 0, Math.PI * 2)
    ctx.fill()
    font(ctx, fonts.sans, 20, "500")
    const label = ellipsize(ctx, `${row.name}  ${row.pctText}`, 240)
    text(ctx, label, sx + 20, sy, INK)
    sx += ctx.measureText(label).width + 40
  })
  return sy + 8
}

/** Pinta la tarjeta completa. El canvas debe medir 1080×1350. */
export function drawShareMonth(
  ctx: Ctx,
  view: ShareMonthView,
  options?: { width?: number; height?: number; fonts?: ShareMonthFonts },
) {
  const width = options?.width ?? SHARE_MONTH_WIDTH
  const height = options?.height ?? SHARE_MONTH_HEIGHT
  const fonts = options?.fonts ?? DEFAULT_FONTS
  const scale = width / SHARE_MONTH_WIDTH
  ctx.save()
  ctx.scale(scale, scale)
  const W = SHARE_MONTH_WIDTH
  const H = SHARE_MONTH_HEIGHT

  ctx.fillStyle = SHARE_MONTH_BG
  ctx.fillRect(0, 0, W, H)

  // Marco fino y carril naranja a la izquierda: estructura de cartel, no de tarjeta centrada.
  strokeRound(ctx, 28, 28, W - 56, H - 56, 28, "rgba(245,165,36,0.22)", 2)
  fillRound(ctx, 28, 86, 10, H - 200, 6, GOLD)

  const left = 72
  const right = W - 56
  const contentW = right - left

  drawGarraMark(ctx, left, 56, 56)
  font(ctx, fonts.sans, 18, "600")
  ctx.letterSpacing = "0.22em"
  text(ctx, "MI MES", left + 72, 78, GOLD)
  ctx.letterSpacing = "0px"
  font(ctx, fonts.sans, 20, "400")
  text(ctx, "en Garra", left + 72, 104, MUTED)

  font(ctx, fonts.heading, 92, "800")
  text(ctx, view.monthName, left, 200, INK)
  font(ctx, fonts.heading, 36, "500")
  const byline = view.displayName ? `${view.year}  ·  ${view.displayName}` : String(view.year)
  text(ctx, byline, left, 248, GOLD)

  ctx.strokeStyle = "rgba(245,165,36,0.35)"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(left, 276)
  ctx.lineTo(right, 276)
  ctx.stroke()

  font(ctx, fonts.sans, 20, "600")
  ctx.letterSpacing = "0.14em"
  text(ctx, "INGRESOS DEL MES", left, 318, MUTED)
  ctx.letterSpacing = "0px"

  font(ctx, fonts.heading, 78, "800")
  text(ctx, view.incomeText, left, 396, GOLD)

  const delta = [view.incomeDeltaText, view.incomeDeltaPctText].filter(Boolean).join("  ·  ")
  if (delta) {
    font(ctx, fonts.sans, 24, "600")
    const dw = ctx.measureText(delta).width + 40
    const dx = Math.min(left, right - dw)
    const dy = 418
    fillRound(ctx, dx, dy, dw, 44, 22, view.incomeUp ? "rgba(43,217,160,0.12)" : "rgba(255,107,91,0.12)")
    text(ctx, delta, dx + dw / 2, dy + 30, view.incomeUp ? GREEN : RED, "center")
  }

  const metricsY = 492
  fillRound(ctx, left, metricsY, contentW, 132, 24, CARD)
  strokeRound(ctx, left, metricsY, contentW, 132, 24, LINE, 1)
  const cols = [
    { label: "Ingresos", value: view.incomeMetric, color: GOLD },
    { label: "Gastos", value: view.expensesMetric, color: RED },
    { label: "Neto", value: view.netMetric, color: view.netPositive ? GREEN : RED },
  ]
  const colW = contentW / 3
  cols.forEach((col, i) => {
    const cx = left + colW * i
    if (i > 0) {
      ctx.strokeStyle = LINE
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx, metricsY + 24)
      ctx.lineTo(cx, metricsY + 108)
      ctx.stroke()
    }
    font(ctx, fonts.sans, 18, "600")
    text(ctx, col.label, cx + colW / 2, metricsY + 42, MUTED, "center")
    font(ctx, fonts.heading, 28, "700")
    const value = ellipsize(ctx, col.value, colW - 28)
    text(ctx, value, cx + colW / 2, metricsY + 88, col.color, "center")
  })

  const sourcesBottom = drawSources(ctx, view, left, 660, contentW, fonts)

  const chartTitleY = Math.max(sourcesBottom + 48, 860)
  font(ctx, fonts.heading, 24, "600")
  text(ctx, "Los últimos 6 meses", left, chartTitleY, INK)
  font(ctx, fonts.sans, 16, "500")
  ctx.fillStyle = RED
  ctx.beginPath()
  ctx.arc(right - 86, chartTitleY - 6, 5, 0, Math.PI * 2)
  ctx.fill()
  text(ctx, "Gastos", right, chartTitleY, RED, "right")
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.arc(right - 200, chartTitleY - 6, 5, 0, Math.PI * 2)
  ctx.fill()
  text(ctx, "Ingresos", right - 100, chartTitleY, GOLD, "right")

  const chartH = 188
  drawLineChart(ctx, view, left + 8, chartTitleY + 18, contentW - 16, chartH, fonts)

  const panelY = chartTitleY + 18 + chartH + 28
  const gap = 16
  const panelW = (contentW - gap) / 2
  const panelH = 130
  fillRound(ctx, left, panelY, panelW, panelH, 24, CARD)
  strokeRound(ctx, left, panelY, panelW, panelH, 24, "rgba(245,165,36,0.35)", 1.5)
  font(ctx, fonts.sans, 16, "600")
  ctx.letterSpacing = "0.12em"
  text(ctx, "TASA DE AHORRO", left + 24, panelY + 36, GOLD)
  ctx.letterSpacing = "0px"
  font(ctx, fonts.heading, 64, "800")
  text(ctx, view.savingsRateText, left + 24, panelY + 104, GOLD)

  const rightX = left + panelW + gap
  fillRound(ctx, rightX, panelY, panelW, panelH, 24, CARD)
  strokeRound(ctx, rightX, panelY, panelW, panelH, 24, LINE, 1)
  font(ctx, fonts.sans, 16, "600")
  ctx.letterSpacing = "0.12em"
  text(ctx, "TU MAYOR GASTO", rightX + 24, panelY + 36, MUTED)
  ctx.letterSpacing = "0px"
  if (view.topExpense) {
    font(ctx, fonts.heading, 30, "700")
    text(ctx, ellipsize(ctx, view.topExpense.name, panelW - 48), rightX + 24, panelY + 78, INK)
    font(ctx, fonts.sans, 22, "500")
    text(ctx, `${view.topExpense.amountText}  ·  ${view.topExpense.pctText}`, rightX + 24, panelY + 108, MUTED)
  } else {
    font(ctx, fonts.sans, 22, "400")
    text(ctx, "Sin gastos este mes", rightX + 24, panelY + 80, MUTED)
  }

  const footerY = panelY + panelH + 28
  drawGarraMark(ctx, left, footerY, 36)
  font(ctx, fonts.sans, 20, "500")
  text(ctx, view.footer, left + 48, footerY + 26, MUTED)

  ctx.restore()
}

export function createShareMonthCanvas(view: ShareMonthView, options?: { fonts?: ShareMonthFonts }): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = SHARE_MONTH_WIDTH
  canvas.height = SHARE_MONTH_HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo crear la imagen")
  drawShareMonth(ctx, view, { fonts: options?.fonts })
  return canvas
}

export function shareMonthBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("No se pudo generar el PNG"))
    }, "image/png")
  })
}
