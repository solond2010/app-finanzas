// Colores de cuenta: paleta ampliada (16 tonos que conviven con el naranja de
// Garra en claro y oscuro), color por defecto estable para cuentas sin color
// y un reparto «distinguible» para gráficos donde dos cuentas no deberían
// confundirse.

export const ACCOUNT_COLORS: { hex: string; name: string }[] = [
  { hex: "#F5A524", name: "Naranja Garra" },
  { hex: "#FF8A3D", name: "Mandarina" },
  { hex: "#FF6B5B", name: "Coral" },
  { hex: "#E5484D", name: "Rojo" },
  { hex: "#F06292", name: "Rosa" },
  { hex: "#C084FC", name: "Lila" },
  { hex: "#8B5CF6", name: "Violeta" },
  { hex: "#6366F1", name: "Índigo" },
  { hex: "#3B82F6", name: "Azul" },
  { hex: "#38BDF8", name: "Celeste" },
  { hex: "#14B8A6", name: "Turquesa" },
  { hex: "#2BD9A0", name: "Verde Garra" },
  { hex: "#84CC16", name: "Lima" },
  { hex: "#FACC15", name: "Amarillo" },
  { hex: "#B08968", name: "Tierra" },
  { hex: "#8B95A5", name: "Pizarra" },
]

const HEX = /^#([0-9a-f]{6})$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim())
}

export function normalizeHex(value: string): string {
  return value.trim().toUpperCase()
}

function hash(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Color por defecto estable (mismo id → mismo color) para cuentas sin color. */
export function defaultAccountColor(id: string): string {
  return ACCOUNT_COLORS[hash(id) % ACCOUNT_COLORS.length].hex
}

/** Color con el que pintar una cuenta: el suyo si es válido, si no uno estable. */
export function accountColor(account: { id: string; color?: string | null }): string {
  return isHexColor(account.color) ? normalizeHex(account.color) : defaultAccountColor(account.id)
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Distancia perceptual aproximada («redmean») entre dos colores hex. */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const rm = (r1 + r2) / 2
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}

export const TOO_CLOSE = 60

/**
 * Colores para un gráfico: cada cuenta conserva el suyo salvo que se confunda
 * con uno ya usado (o con `reserved`); entonces toma el tono libre de la paleta
 * más alejado de los ya elegidos.
 */
export function distinctAccountColors(
  accounts: { id: string; color?: string | null }[],
  reserved: string[] = [],
): Map<string, string> {
  const used: string[] = reserved.filter(isHexColor).map(normalizeHex)
  const out = new Map<string, string>()
  for (const account of accounts) {
    let color = accountColor(account)
    if (used.some((u) => colorDistance(u, color) < TOO_CLOSE)) {
      const candidates = ACCOUNT_COLORS.map((c) => c.hex).filter((c) => !used.includes(c))
      if (candidates.length > 0) {
        color = candidates.reduce((best, c) => {
          const score = (x: string) => Math.min(...used.map((u) => colorDistance(u, x)))
          return score(c) > score(best) ? c : best
        })
      }
    }
    used.push(color)
    out.set(account.id, color)
  }
  return out
}

/** Negro o blanco, lo que se lea mejor encima de `hex`. */
export function readableOn(hex: string): "#111111" | "#FFFFFF" {
  const [r, g, b] = rgb(isHexColor(hex) ? hex : "#F5A524").map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.22 ? "#111111" : "#FFFFFF"
}
