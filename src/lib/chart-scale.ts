/**
 * Linear chart domain for net-worth series. If the visible data is nearly
 * flat, keep at least a 24% band around the balance so small currency changes
 * do not fill the whole chart; larger changes expand the domain linearly.
 */
export function getNetWorthChartDomain(values: number[]) {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return { min: 0, max: 1 }

  const rawMin = Math.min(...finite)
  const rawMax = Math.max(...finite)
  const center = (rawMin + rawMax) / 2
  const balanceScale = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1)
  const minimumSpan = balanceScale * 0.24
  const paddedDataSpan = (rawMax - rawMin) * 1.24
  const span = Math.max(minimumSpan, paddedDataSpan, 1)

  return { min: center - span / 2, max: center + span / 2 }
}
