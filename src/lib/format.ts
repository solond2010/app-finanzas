export function money(value: number) {
  return `${value.toLocaleString("es-ES")}€`
}

export function signedMoney(value: number) {
  return `${value >= 0 ? "+" : ""}${money(value)}`
}

export function chartFormatter(value: number) {
  return money(value)
}

// Un % calculado contra una base pequeña (p.ej. patrimonio de 50€ hace 6 meses)
// puede dispararse a miles de %. Por encima de este umbral se muestra ">CAP%"
// en vez de la cifra exacta (falsa precisión) para no parecer un dato roto.
export const PCT_CHANGE_CAP = 500

export function formatCappedPct(value: number, cap = PCT_CHANGE_CAP) {
  const sign = value >= 0 ? "+" : "-"
  const magnitude = Math.round(Math.abs(value))
  return magnitude > cap ? `${sign}>${cap}%` : `${sign}${magnitude}%`
}

export function formatMonth(date: Date) {
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
}

export function formatMonthShort(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" })
}

// Excluye del análisis de ingresos/gastos las transacciones que no son movimientos
// reales: el saldo inicial al crear una cuenta ("init_") y los ajustes de saldo al
// editarla ("adj_") — ambas existen solo para que account.saldo cuadre con la suma
// de transacciones, no representan actividad económica real de ese mes.
export function isInitialBalanceTransaction(id: string) {
  return id.startsWith("init_") || id.startsWith("adj_")
}

export function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Buenos días"
  if (h < 18) return "Buenas tardes"
  return "Buenas noches"
}

export function dateLabel(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Hoy"
  if (d.toDateString() === yesterday.toDateString()) return "Ayer"
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
}
