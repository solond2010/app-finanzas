export function money(value: number) {
  return `${value.toLocaleString("es-ES")}€`
}

export function signedMoney(value: number) {
  return `${value >= 0 ? "+" : ""}${money(value)}`
}

export function chartFormatter(value: number) {
  return money(value)
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
