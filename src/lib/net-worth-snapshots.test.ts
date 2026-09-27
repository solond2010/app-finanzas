import { describe, it, expect } from "vitest"
import {
  mergeNetWorthSnapshots,
  applyStoredSnapshotsToRows,
  type StoredNetWorthSnapshot,
} from "./net-worth-snapshots"

describe("mergeNetWorthSnapshots", () => {
  it("conserva el máximo patrimonio por fecha y añade fechas nuevas", () => {
    const stored: StoredNetWorthSnapshot[] = [
      { date: "2026-08-05", patrimonio: 5300, updatedAt: "2026-08-05T10:00:00Z" },
      { date: "2026-07-05", patrimonio: 4000, updatedAt: "2026-07-05T10:00:00Z" },
    ]
    const computed = [
      { date: "2026-08-05", patrimonio: 2100 }, // recálculo incompleto: no debe bajar
      { date: "2026-09-05", patrimonio: 2500 },
    ]
    const merged = mergeNetWorthSnapshots(stored, computed)
    expect(merged.find((r) => r.date === "2026-08-05")?.patrimonio).toBe(5300)
    expect(merged.find((r) => r.date === "2026-09-05")?.patrimonio).toBe(2500)
    expect(merged.find((r) => r.date === "2026-07-05")?.patrimonio).toBe(4000)
  })

  it("sube el valor si el cálculo nuevo es mayor", () => {
    const stored: StoredNetWorthSnapshot[] = [
      { date: "2026-08-05", patrimonio: 2000, updatedAt: "2026-08-05T10:00:00Z" },
    ]
    const merged = mergeNetWorthSnapshots(stored, [{ date: "2026-08-05", patrimonio: 3000 }])
    expect(merged[0].patrimonio).toBe(3000)
  })
})

describe("applyStoredSnapshotsToRows", () => {
  it("sustituye patrimonio si el guardado es mayor; no inventa filas", () => {
    const rows = [
      { date: "2026-08-05", patrimonio: 2100, label: "a" },
      { date: "2026-09-05", patrimonio: 2200, label: "b" },
    ]
    const stored: StoredNetWorthSnapshot[] = [
      { date: "2026-08-05", patrimonio: 5300, updatedAt: "x" },
      { date: "2026-06-05", patrimonio: 9999, updatedAt: "x" }, // no está en rows → no se inventa
    ]
    const applied = applyStoredSnapshotsToRows(rows, stored)
    expect(applied).toHaveLength(2)
    expect(applied[0].patrimonio).toBe(5300)
    expect(applied[1].patrimonio).toBe(2200)
  })
})
