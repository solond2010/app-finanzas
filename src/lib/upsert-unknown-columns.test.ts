import { describe, expect, it, vi } from "vitest"
import { missingColumnFromError, stripColumnFromRows, upsertIgnoringUnknownColumns } from "./upsert-unknown-columns"

describe("upsertIgnoringUnknownColumns", () => {
  it("detecta la columna que falta en errores de PostgREST y de Postgres", () => {
    expect(missingColumnFromError("Could not find the 'interest_tae' column of 'accounts' in the schema cache")).toBe("interest_tae")
    expect(missingColumnFromError('column "interest_frequency" of relation "accounts" does not exist')).toBe("interest_frequency")
    expect(missingColumnFromError('column "logo_url" does not exist')).toBe("logo_url")
    expect(missingColumnFromError("duplicate key value violates unique constraint")).toBeNull()
  })

  it("quita solo la columna desconocida y conserva el resto de cada fila", () => {
    const rows = [
      { id: "a1", nombre: "Cuenta", interest_tae: 2.5, saldo: 10 },
      { id: "a2", nombre: "Efectivo", saldo: 3 },
    ]
    expect(stripColumnFromRows(rows, "interest_tae")).toEqual([
      { id: "a1", nombre: "Cuenta", saldo: 10 },
      { id: "a2", nombre: "Efectivo", saldo: 3 },
    ])
  })

  it("reintenta el upsert tras quitar columnas inexistentes y no da ACK si el error es otro", async () => {
    const calls: string[][] = []
    const upsert = vi.fn(async (rows: Record<string, unknown>[]) => {
      calls.push(rows.flatMap((row) => Object.keys(row)))
      if (rows.some((row) => "interest_tae" in row)) {
        return { error: { message: "Could not find the 'interest_tae' column of 'accounts' in the schema cache" } }
      }
      if (rows.some((row) => "interest_frequency" in row)) {
        return { error: { message: 'column "interest_frequency" of relation "accounts" does not exist' } }
      }
      return { error: null }
    })

    const result = await upsertIgnoringUnknownColumns(upsert, [
      { id: "a1", nombre: "Remunerada", interest_tae: 2, interest_frequency: "monthly", saldo: 100 },
      { id: "a2", nombre: "Efectivo", saldo: 20 },
    ])

    expect(result.error).toBeNull()
    expect(result.stripped).toEqual(["interest_tae", "interest_frequency"])
    expect(upsert).toHaveBeenCalledTimes(3)
    expect(calls[2]).toEqual(["id", "nombre", "saldo", "id", "nombre", "saldo"])
  })

  it("no enmascara un error distinto (p. ej. sesión o restricción)", async () => {
    const upsert = vi.fn(async () => ({ error: { message: "No has iniciado sesión" } }))
    const result = await upsertIgnoringUnknownColumns(upsert, [{ id: "a1", saldo: 1 }])
    expect(result.error?.message).toBe("No has iniciado sesión")
    expect(result.stripped).toEqual([])
    expect(upsert).toHaveBeenCalledTimes(1)
  })
})
