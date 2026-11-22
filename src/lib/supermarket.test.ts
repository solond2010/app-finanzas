import { describe, expect, it } from "vitest"
import type { Transaction } from "./store"
import {
  isSupermarketCategory,
  lastUsedStore,
  normalizeStoreName,
  rememberedStores,
  storeLabelForList,
  supermarketStoreBreakdown,
  supermarketStoreTotal,
  tiendaPayload,
  resolvedStoreForCategory,
} from "./supermarket"

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    cuenta_id: "acc1",
    monto: 10,
    fecha: "2026-11-10",
    tipo: "gasto",
    categoria: "Supermercado",
    es_necesidad: true,
    descripcion: "Compra",
    tags: [],
    ...overrides,
  }
}

describe("isSupermarketCategory", () => {
  it("reconoce la categoría predeterminada y alias habituales", () => {
    expect(isSupermarketCategory("Supermercado")).toBe(true)
    expect(isSupermarketCategory("  SÚPER ")).toBe(true)
    expect(isSupermarketCategory("Hipermercado")).toBe(true)
    expect(isSupermarketCategory("Supermercado extra")).toBe(true)
    expect(isSupermarketCategory("Restaurantes")).toBe(false)
    expect(isSupermarketCategory("Café")).toBe(false)
    expect(isSupermarketCategory("")).toBe(false)
  })
})

describe("normalizeStoreName y payload", () => {
  it("recorta espacios y la longitud, y no envía el campo si el cliente viejo no lo tenía", () => {
    expect(normalizeStoreName("  Ahorramas  ")).toBe("Ahorramas")
    expect(normalizeStoreName("x".repeat(50)).length).toBe(40)
    expect(tiendaPayload(undefined)).toEqual({})
    expect(tiendaPayload("")).toEqual({ tienda: "" })
    expect(tiendaPayload("Lidl")).toEqual({ tienda: "Lidl" })
  })

  it("al cambiar de categoría deja la tienda vacía, y en súper la guarda", () => {
    expect(resolvedStoreForCategory("Restaurantes", "gasto", "Mercadona")).toBe("")
    expect(resolvedStoreForCategory("Supermercado", "ingreso", "Mercadona")).toBe("")
    expect(resolvedStoreForCategory("Supermercado", "gasto", "  Consum ")).toBe("Consum")
  })
})

describe("rememberedStores y lastUsedStore", () => {
  it("recuerda tiendas propias, sin repetir chips fijos, y prellena la última de súper", () => {
    const rows = [
      tx({ id: "1", fecha: "2026-11-01", tienda: "Mercadona", created_at: "2026-11-01T10:00:00.000Z" }),
      tx({ id: "2", fecha: "2026-11-05", tienda: "Ahorramas", created_at: "2026-11-05T10:00:00.000Z" }),
      tx({ id: "3", fecha: "2026-11-08", tienda: "Ahorramas", created_at: "2026-11-08T10:00:00.000Z" }),
      tx({ id: "4", fecha: "2026-11-09", tienda: "Consum", created_at: "2026-11-09T10:00:00.000Z" }),
      tx({ id: "5", fecha: "2026-11-10", categoria: "Restaurantes", tienda: "McDonalds", created_at: "2026-11-10T10:00:00.000Z" }),
    ]
    expect(rememberedStores(rows)).toEqual(["Consum", "Ahorramas"])
    expect(lastUsedStore(rows)).toBe("Consum")
    expect(lastUsedStore([tx({ categoria: "Restaurantes", tienda: "McDonalds" })])).toBe("")
  })
})

describe("supermarketStoreBreakdown", () => {
  it("agrupa el mes, pone porcentaje y deja Sin tienda al final si empata el orden", () => {
    const rows = [
      tx({ id: "a", monto: 186.4, tienda: "Mercadona" }),
      tx({ id: "b", monto: 97.8, tienda: "Lidl" }),
      tx({ id: "c", monto: 71.2, tienda: "Carrefour" }),
      tx({ id: "d", monto: 53.4, tienda: "Alcampo" }),
      tx({ id: "e", monto: 22.1, tienda: "Ahorramas" }),
      tx({ id: "f", monto: 13.1, tienda: "" }),
      tx({ id: "g", monto: 80, fecha: "2026-10-20", tienda: "Lidl" }),
      tx({ id: "h", monto: 40, categoria: "Restaurantes", tienda: "Mercadona" }),
    ]
    const breakdown = supermarketStoreBreakdown(rows, "2026-11")
    expect(breakdown.map((row) => [row.tienda, row.monto, row.porcentaje])).toEqual([
      ["Mercadona", 186.4, 42],
      ["Lidl", 97.8, 22],
      ["Carrefour", 71.2, 16],
      ["Alcampo", 53.4, 12],
      ["Ahorramas", 22.1, 5],
      ["Sin tienda", 13.1, 3],
    ])
    expect(supermarketStoreTotal(breakdown)).toBeCloseTo(444, 5)
  })

  it("no incluye transferencias ni meses distintos, y acepta filas sin el campo tienda", () => {
    const rows = [
      tx({ id: "old", monto: 20, descripcion: "Compra vieja" }),
      tx({ id: "tr-out", monto: 15, tienda: "Lidl", tags: ["traspaso", "traspaso:pair"] }),
      tx({ id: "tr-in", tipo: "ingreso", cuenta_id: "acc2", monto: 15, tienda: "Lidl", tags: ["traspaso", "traspaso:pair"] }),
    ]
    const breakdown = supermarketStoreBreakdown(rows, "2026-11")
    expect(breakdown).toEqual([{ tienda: "Sin tienda", monto: 20, porcentaje: 100 }])
  })
})

describe("storeLabelForList", () => {
  it("oculta la tienda bajo el título si ya coincide con la descripción", () => {
    expect(storeLabelForList(tx({ descripcion: "Compra de la semana", tienda: "Mercadona" }))).toBe("Mercadona")
    expect(storeLabelForList(tx({ descripcion: "Mercadona", tienda: "Mercadona" }))).toBe("")
    expect(storeLabelForList(tx({ descripcion: "", categoria: "Supermercado", tienda: "" }))).toBe("")
  })
})
