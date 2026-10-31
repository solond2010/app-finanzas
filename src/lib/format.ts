import { parseLocalDate } from "./date-utils"

// Espacio fino inseparable entre cifra y símbolo (convención tipográfica
// española); inseparable para que "1.234" y "€" nunca partan de línea.
export const NNBSP = " "

export function money(value: number) {
  // max 2 decimales: toLocaleString deja hasta 3 por defecto y "908,238 €"
  // se lee como novecientos ocho mil (mismo problema documentado en
  // sinking-funds.tsx con los valores de mercado).
  // useGrouping "always": en es-ES el separador de miles se omite con 4 cifras
  // ("1525 €" junto a "25.000 €"). Con decimales, siempre dos ("22.067,20 €").
  const hasCents = Math.round(Math.abs(value) * 100) % 100 !== 0
  return `${value.toLocaleString("es-ES", { useGrouping: "always", minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}${NNBSP}€`
}

export function signedMoney(value: number) {
  return `${value >= 0 ? "+" : ""}${money(value)}`
}

export function chartFormatter(value: number) {
  return money(value)
}

// Para ejes: sin céntimos ("2.834 €", no "2833,6 €").
export function chartAxisFormatter(value: number) {
  return money(Math.round(value))
}

// Reserva espacio suficiente para las etiquetas monetarias de los ejes Y.
// El valor máximo de un gráfico puede crecer con el historial del usuario;
// dejar un ancho fijo acaba cortando cifras en vez de reflejar el importe.
export function moneyAxisWidth(values: number[], minWidth = 64, maxWidth = 128) {
  const longestLabel = values.reduce((longest, value) => Math.max(longest, chartFormatter(value).length), 0)
  // +1 carácter de margen por si Recharts redondea el tick superior.
  return Math.min(maxWidth, Math.max(minWidth, Math.ceil((longestLabel + 1) * 7 + 16)))
}

// Un % calculado contra una base pequeña (p.ej. patrimonio de 50€ hace 6 meses)
// puede dispararse a miles de %. Por encima de este umbral se muestra ">CAP%"
// en vez de la cifra exacta (falsa precisión) para no parecer un dato roto.
export const PCT_CHANGE_CAP = 500

export function formatCappedPct(value: number, cap = PCT_CHANGE_CAP) {
  const magnitude = Math.round(Math.abs(value))
  // Un cambio que redondea a cero no lleva signo: "-0,4%" mostraba "-0%".
  if (magnitude === 0) return "0%"
  const sign = value >= 0 ? "+" : "-"
  return magnitude > cap ? `${sign}>${cap}%` : `${sign}${magnitude}%`
}

// Capitaliza solo la primera letra ("Julio de 2026"). No usar la clase CSS
// `capitalize` sobre este texto: capitaliza cada palabra y produce "Julio De 2026".
export function formatMonth(date: Date) {
  const s = date.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Excluye del análisis de ingresos/gastos las transacciones que no son movimientos
// reales: el saldo inicial al crear una cuenta ("init_") y los ajustes de saldo al
// editarla ("adj_") — ambas existen solo para que account.saldo cuadre con la suma
// de transacciones, no representan actividad económica real de ese mes.
export function isInitialBalanceTransaction(id: string) {
  return id.startsWith("init_") || id.startsWith("adj_")
}

export function dateLabel(dateStr: string) {
  const d = parseLocalDate(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Hoy"
  if (d.toDateString() === yesterday.toDateString()) return "Ayer"
  const s = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
