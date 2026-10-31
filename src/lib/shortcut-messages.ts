// Textos que devuelve /api/shortcuts/* para que el Atajo compartido los
// enseñe tal cual en su notificación (sin JSON a la vista).

export const AUTO_CATEGORY = "Automática"

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

export function movementMessage(tipo: "gasto" | "ingreso", amount: number, currency: string, categoria: string, cuenta: string) {
  const label = tipo === "gasto" ? "Gasto" : "Ingreso"
  return `✅ ${label} de ${money(amount, currency)} apuntado · ${categoria} · ${cuenta}`
}

export function transferMessage(amount: number, currency: string, origen: string, destino: string) {
  return `✅ Traspaso de ${money(amount, currency)} apuntado · ${origen} → ${destino}`
}
