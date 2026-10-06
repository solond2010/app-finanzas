import { getSetting, setSetting } from "./settings"

/** Snapshots mensuales de patrimonio (día 5) persistidos en `settings`. */
const SNAPSHOTS_KEY = "net_worth_monthly_snapshots"
const PEAK_KEY = "net_worth_peak"

export type StoredNetWorthSnapshot = {
  /** YYYY-MM-DD del punto (típicamente día 5). */
  date: string
  patrimonio: number
  /** ISO timestamp de la última actualización. */
  updatedAt: string
}

export type StoredNetWorthPeak = {
  value: number
  date: string
  label: string
}

function parseSnapshots(raw: string | null | undefined): StoredNetWorthSnapshot[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((row): row is StoredNetWorthSnapshot =>
        !!row &&
        typeof row === "object" &&
        typeof (row as StoredNetWorthSnapshot).date === "string" &&
        typeof (row as StoredNetWorthSnapshot).patrimonio === "number" &&
        Number.isFinite((row as StoredNetWorthSnapshot).patrimonio)
      )
      .map((row) => ({
        date: row.date,
        patrimonio: row.patrimonio,
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
      }))
  } catch {
    return []
  }
}

function parsePeak(raw: string | null | undefined): StoredNetWorthPeak | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredNetWorthPeak>
    if (typeof parsed.value !== "number" || !Number.isFinite(parsed.value)) return null
    return {
      value: parsed.value,
      date: typeof parsed.date === "string" ? parsed.date : "",
      label: typeof parsed.label === "string" ? parsed.label : "",
    }
  } catch {
    return null
  }
}

export async function loadNetWorthSnapshots(): Promise<StoredNetWorthSnapshot[]> {
  const raw = await getSetting(SNAPSHOTS_KEY)
  if (raw === undefined) throw new Error("No se pudieron consultar los históricos guardados")
  return parseSnapshots(raw)
}

export async function loadNetWorthPeak(): Promise<StoredNetWorthPeak | null> {
  const raw = await getSetting(PEAK_KEY)
  if (raw === undefined) throw new Error("No se pudo consultar el máximo guardado")
  return parsePeak(raw)
}

/**
 * Fusiona snapshots calculados con los ya guardados.
 * Por cada fecha conserva el MÁXIMO patrimonio visto (nunca baja un histórico
 * por un recálculo posterior con datos incompletos). Los puntos nuevos se añaden.
 */
export function mergeNetWorthSnapshots(
  stored: StoredNetWorthSnapshot[],
  computed: Array<{ date: string; patrimonio: number }>
): StoredNetWorthSnapshot[] {
  const byDate = new Map<string, StoredNetWorthSnapshot>()
  for (const row of stored) {
    if (!row.date || !Number.isFinite(row.patrimonio)) continue
    byDate.set(row.date, row)
  }
  const now = new Date().toISOString()
  for (const point of computed) {
    if (!point.date || !Number.isFinite(point.patrimonio)) continue
    // No persistir provisionales del mes en curso (fecha ≠ día 5 típico se
    // filtra en el caller; aquí solo evitamos ceros espurios).
    const prev = byDate.get(point.date)
    if (!prev || point.patrimonio > prev.patrimonio) {
      byDate.set(point.date, { date: point.date, patrimonio: point.patrimonio, updatedAt: now })
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export async function saveNetWorthSnapshots(rows: StoredNetWorthSnapshot[]): Promise<void> {
  await setSetting(SNAPSHOTS_KEY, JSON.stringify(rows))
}

/**
 * Carga, fusiona con lo calculado y guarda. Devuelve el resultado fusionado.
 */
export async function persistMergedNetWorthSnapshots(
  computed: Array<{ date: string; patrimonio: number }>
): Promise<StoredNetWorthSnapshot[]> {
  const stored = await loadNetWorthSnapshots()
  const merged = mergeNetWorthSnapshots(stored, computed)
  // Solo escribe si hay cambio real (evita spam de POSTs en cada render).
  if (JSON.stringify(merged) !== JSON.stringify(stored)) {
    await saveNetWorthSnapshots(merged)
  }
  return merged
}

export async function persistNetWorthPeakIfHigher(peak: StoredNetWorthPeak): Promise<StoredNetWorthPeak> {
  const prev = await loadNetWorthPeak()
  if (prev && prev.value >= peak.value) return prev
  const saved = await setSetting(PEAK_KEY, JSON.stringify(peak))
  if (!saved) throw new Error("No se pudo guardar el máximo histórico en la nube")
  return peak
}

/**
 * Aplica snapshots persistidos sobre filas mensuales derivadas: si hay un valor
 * guardado mayor para esa fecha, lo usa (protege el histórico ante pérdida de
 * saldos/cuentas). No inventa fechas que no existan en `rows`.
 */
export function applyStoredSnapshotsToRows<T extends { date: string; patrimonio: number }>(
  rows: T[],
  stored: StoredNetWorthSnapshot[]
): T[] {
  if (stored.length === 0) return rows
  const byDate = new Map(stored.map((s) => [s.date, s.patrimonio]))
  return rows.map((row) => {
    const saved = byDate.get(row.date)
    if (saved === undefined || saved <= row.patrimonio) return row
    return { ...row, patrimonio: saved }
  })
}
