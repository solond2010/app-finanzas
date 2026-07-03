import { describe, it, expect } from "vitest"
import type { Account, Transaction } from "./store"
import {
  isTransfer,
  getSavingsRate,
  getMonthTotalsByString,
  getAccountsAtMonth,
  getNetWorthAtMonth,
  getCategoryBreakdown,
  getUpcomingRecurring,
  calculateMonthlySaving,
} from "./calculations"

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc_1",
    nombre: "Cuenta",
    tipo: "ahorro",
    banco: "",
    saldo: 1000,
    currency: "EUR",
    objetivo: null,
    limite_mensual: null,
    color: "#000",
    ...overrides,
  }
}

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx_1",
    cuenta_id: "acc_1",
    monto: 100,
    fecha: "2026-06-15",
    tipo: "gasto",
    categoria: "Otros",
    es_necesidad: true,
    descripcion: "",
    tags: [],
    ...overrides,
  }
}

describe("isTransfer", () => {
  it("solo es traspaso si tiene el tag 'traspaso'", () => {
    expect(isTransfer(tx({ tags: ["traspaso"] }))).toBe(true)
    expect(isTransfer(tx({ tags: [] }))).toBe(false)
    expect(isTransfer(tx({ tags: undefined as unknown as string[] }))).toBe(false)
  })
})

describe("getSavingsRate", () => {
  it("se acota en -100% cuando el gasto dispara la ratio con ingresos bajos", () => {
    // Caso real que motivó el fix: ingresos de 10€ y un neto de -750€.
    expect(getSavingsRate(10, -750)).toBe(-100)
  })

  it("devuelve 0 si no hay ingresos (evita división por cero)", () => {
    expect(getSavingsRate(0, -50)).toBe(0)
  })

  it("calcula el % normal dentro de rango", () => {
    expect(getSavingsRate(1000, 200)).toBe(20)
  })
})

describe("getMonthTotalsByString", () => {
  it("excluye traspasos de ingresos y gastos", () => {
    const txns = [
      tx({ tipo: "ingreso", monto: 1000, fecha: "2026-06-01" }),
      tx({ tipo: "gasto", monto: 300, fecha: "2026-06-02" }),
      tx({ tipo: "ingreso", monto: 50, fecha: "2026-06-03", tags: ["traspaso"] }),
      tx({ tipo: "gasto", monto: 50, fecha: "2026-06-03", tags: ["traspaso"] }),
      tx({ tipo: "gasto", monto: 999, fecha: "2026-05-15" }), // otro mes, no cuenta
    ]
    expect(getMonthTotalsByString(txns, "2026-06")).toEqual({ ingresos: 1000, gastos: 300, neto: 700 })
  })
})

describe("getAccountsAtMonth / getNetWorthAtMonth (reconstrucción de saldo)", () => {
  it("resta correctamente un ingreso posterior al mes consultado", () => {
    const accounts = [account({ saldo: 500 })]
    const txns = [tx({ tipo: "ingreso", monto: 200, fecha: "2026-06-10" })]
    // El saldo actual (500) ya incluye ese ingreso de junio; en mayo debía ser 300.
    const atMay = getAccountsAtMonth(accounts, txns, "2026-05")
    expect(atMay[0].saldo).toBe(300)
  })

  it("suma correctamente un gasto posterior al mes consultado (se deshace)", () => {
    const accounts = [account({ saldo: 100 })]
    const txns = [tx({ tipo: "gasto", monto: 40, fecha: "2026-06-10" })]
    // El saldo actual (100) ya refleja ese gasto; antes de junio debía ser 140.
    const atMay = getAccountsAtMonth(accounts, txns, "2026-05")
    expect(atMay[0].saldo).toBe(140)
  })

  it("un ajuste de saldo a la baja (monto negativo, tipo ingreso) resta patrimonio, no suma", () => {
    // Reproduce el caso de UPDATE_ACCOUNT: delta negativo guardado como tipo "ingreso".
    const accounts = [account({ saldo: 460 })]
    const txns = [tx({ id: "adj_1", tipo: "ingreso", monto: -40, fecha: "2026-06-10" })]
    expect(getNetWorthAtMonth(accounts, txns, "2026-05")).toBe(500)
  })
})

describe("getCategoryBreakdown", () => {
  it("agrupa por categoría, suma montos y ordena de mayor a menor", () => {
    const txns = [
      tx({ categoria: "Comida", monto: 50 }),
      tx({ categoria: "Ocio", monto: 200 }),
      tx({ categoria: "Comida", monto: 30 }),
      tx({ tipo: "ingreso", categoria: "Comida", monto: 999 }), // no cuenta, es ingreso
    ]
    expect(getCategoryBreakdown(txns, "2026-06")).toEqual([
      { categoria: "Ocio", monto: 200 },
      { categoria: "Comida", monto: 80 },
    ])
  })
})

describe("getUpcomingRecurring", () => {
  it("calcula el próximo vencimiento a un mes de la última ocurrencia", () => {
    const txns = [tx({ tags: ["recurrente"], categoria: "Alquiler", descripcion: "Piso", monto: 700, fecha: "2026-05-01" })]
    const [item] = getUpcomingRecurring(txns)
    expect(item.nextDate).toBe("2026-06-01")
  })

  it("usa solo la ocurrencia más reciente del grupo para calcular el próximo vencimiento", () => {
    const txns = [
      tx({ id: "a", tags: ["recurrente"], categoria: "Alquiler", descripcion: "Piso", fecha: "2026-04-01" }),
      tx({ id: "b", tags: ["recurrente"], categoria: "Alquiler", descripcion: "Piso", fecha: "2026-05-01" }),
    ]
    expect(getUpcomingRecurring(txns)).toHaveLength(1)
    expect(getUpcomingRecurring(txns)[0].nextDate).toBe("2026-06-01")
  })

  it("ignora traspasos y transacciones sin el tag recurrente", () => {
    const txns = [tx({ tags: ["traspaso", "recurrente"] }), tx({ tags: [] })]
    expect(getUpcomingRecurring(txns)).toHaveLength(0)
  })

  it("respeta la cadencia semanal/anual guardada en el tag recurrente:X", () => {
    const semanal = getUpcomingRecurring([tx({ tags: ["recurrente:semanal"], categoria: "Gym", fecha: "2026-06-01" })])[0]
    expect(semanal.frequency).toBe("semanal")
    expect(semanal.nextDate).toBe("2026-06-08")

    const anual = getUpcomingRecurring([tx({ tags: ["recurrente:anual"], categoria: "Seguro", fecha: "2026-06-01" })])[0]
    expect(anual.frequency).toBe("anual")
    expect(anual.nextDate).toBe("2027-06-01")
  })

  it("el tag 'recurrente' a secas sigue siendo mensual (compatibilidad con datos antiguos)", () => {
    const item = getUpcomingRecurring([tx({ tags: ["recurrente"], fecha: "2026-06-01" })])[0]
    expect(item.frequency).toBe("mensual")
  })
})

describe("calculateMonthlySaving", () => {
  it("devuelve 0 si el plazo ya venció", () => {
    expect(calculateMonthlySaving(1000, 0, "2020-01-01")).toBe(0)
  })
})
