// Validación compartida de "importe en euros" para los formularios de la app
// (transacción, cuenta, presupuesto, meta de ahorro, posición). Antes cada
// formulario hacía `Number(valor) || 0` o directamente `Number(valor)`: un
// texto no numérico como "abc" da NaN, y `NaN || 0` cae a 0 en silencio
// mientras que un `Number(valor)` sin guardia guarda NaN en el estado — en
// ambos casos el dato que el usuario escribió se pierde sin avisarle.
//
// Acepta coma decimal (frecuente al escribir en teclado numérico español).
export function parseAmount(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === "") return null
  const n = Number(trimmed.replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

// Igual que parseAmount pero acepta 0 (saldo inicial de una cuenta nueva,
// aportación ya reflejada, etc.) y trata el campo vacío como 0 en vez de como
// inválido.
export function parseAmountOrZero(value: string): number {
  const trimmed = value.trim()
  if (trimmed === "") return 0
  const n = Number(trimmed.replace(",", "."))
  return Number.isFinite(n) && n >= 0 ? n : NaN
}
