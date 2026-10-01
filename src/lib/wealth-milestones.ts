/** Escalones progresivos para el recorrido de patrimonio, compartidos entre
 * el dashboard y Analíticas para mantener una única fuente de cálculo. */
export function milestoneStepFor(value: number) {
  const safeValue = Math.max(Number.isFinite(value) ? value : 0, 0)
  if (safeValue < 25_000) return 2_500
  if (safeValue < 100_000) return 5_000
  if (safeValue < 250_000) return 10_000
  if (safeValue < 500_000) return 25_000
  if (safeValue < 1_000_000) return 50_000
  return 100_000
}

export function upcomingMilestones(value: number, count: number) {
  const result: number[] = []
  let cursor = Math.max(Number.isFinite(value) ? value : 0, 0)
  for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
    const step = milestoneStepFor(cursor)
    const target = (Math.floor(cursor / step) + 1) * step
    result.push(target)
    cursor = target
  }
  return result
}
