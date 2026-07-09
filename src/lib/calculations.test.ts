import { describe, it, expect } from "vitest"
import type { Account, SinkingFund, Transaction } from "./store"
import {
  isTransfer,
  getSavingsRate,
  getMonthTotalsByString,
  getAccountsAtMonth,
  getNetWorthAtMonth,
  getCategoryBreakdown,
  getUpcomingRecurring,
  calculateMonthlySaving,
  accountGoal,
  getCategoryInsights,
  getFinancialScore,
  getFinancialTips,
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

function fund(overrides: Partial<SinkingFund> = {}): SinkingFund {
  return {
    id: "fund_1",
    nombre: "Meta",
    cantidad_objetivo: 500,
    fecha_limite: "2027-01-01",
    ahorrado_actual: 100,
    cuenta_id: "acc_1",
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

describe("accountGoal", () => {
  it("usa el objetivo propio de la cuenta si lo tiene", () => {
    expect(accountGoal(account({ objetivo: 300 }), [])).toBe(300)
  })

  it("si la cuenta no tiene objetivo propio, suma el de las metas vinculadas", () => {
    const funds = [fund({ cantidad_objetivo: 500, cuenta_id: "acc_1" })]
    expect(accountGoal(account({ objetivo: null }), funds)).toBe(500)
  })

  it("ignora metas vinculadas a otra cuenta", () => {
    const funds = [fund({ cantidad_objetivo: 500, cuenta_id: "acc_2" })]
    expect(accountGoal(account({ objetivo: null }), funds)).toBe(0)
  })

  it("el objetivo propio de la cuenta tiene prioridad sobre las metas vinculadas", () => {
    const funds = [fund({ cantidad_objetivo: 500, cuenta_id: "acc_1" })]
    expect(accountGoal(account({ objetivo: 300 }), funds)).toBe(300)
  })
})

describe("getCategoryInsights", () => {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]

  it("detecta una subida significativa frente a la media de los 5 meses anteriores", () => {
    const txns = [
      ...months.map((m, i) => tx({ id: `r${i}`, categoria: "Restaurantes", monto: 120, fecha: `${m}-15` })),
      tx({ id: "r-jun", categoria: "Restaurantes", monto: 174, fecha: "2026-06-15" }),
    ]
    const [insight] = getCategoryInsights(txns, "2026-06", 1)
    expect(insight.categoria).toBe("Restaurantes")
    expect(insight.average).toBe(120)
    expect(insight.current).toBe(174)
    expect(insight.deltaPct).toBeCloseTo(45, 0)
    expect(insight.isNew).toBe(false)
  })

  it("detecta una bajada significativa", () => {
    const txns = [
      ...months.map((m, i) => tx({ id: `t${i}`, categoria: "Transporte", monto: 100, fecha: `${m}-10` })),
      tx({ id: "t-jun", categoria: "Transporte", monto: 80, fecha: "2026-06-10" }),
    ]
    const [insight] = getCategoryInsights(txns, "2026-06", 1)
    expect(insight.categoria).toBe("Transporte")
    expect(insight.deltaPct).toBeCloseTo(-20, 0)
  })

  it("ignora categorías con importes pequeños (ruido)", () => {
    const txns = [
      ...months.map((m, i) => tx({ id: `g${i}`, categoria: "Regalos", monto: 5, fecha: `${m}-05` })),
      tx({ id: "g-jun", categoria: "Regalos", monto: 9, fecha: "2026-06-05" }),
    ]
    expect(getCategoryInsights(txns, "2026-06")).toHaveLength(0)
  })

  it("marca isNew cuando no hubo gasto en los 5 meses anteriores", () => {
    const txns = [tx({ id: "v-jun", categoria: "Viajes", monto: 200, fecha: "2026-06-20" })]
    const [insight] = getCategoryInsights(txns, "2026-06", 1)
    expect(insight.categoria).toBe("Viajes")
    expect(insight.average).toBe(0)
    expect(insight.isNew).toBe(true)
  })

  it("ordena por mayor desviación absoluta y respeta maxInsights", () => {
    const txns = [
      ...months.map((m, i) => tx({ id: `a${i}`, categoria: "Ocio", monto: 50, fecha: `${m}-01` })),
      tx({ id: "a-jun", categoria: "Ocio", monto: 100, fecha: "2026-06-01" }), // +50 abs
      ...months.map((m, i) => tx({ id: `b${i}`, categoria: "Salud", monto: 200, fecha: `${m}-02` })),
      tx({ id: "b-jun", categoria: "Salud", monto: 400, fecha: "2026-06-02" }), // +200 abs
    ]
    const insights = getCategoryInsights(txns, "2026-06", 1)
    expect(insights).toHaveLength(1)
    expect(insights[0].categoria).toBe("Salud")
  })
})

describe("getFinancialScore", () => {
  it("puntúa 100 y Excelente cuando se cumplen los 4 factores", () => {
    const result = getFinancialScore({
      savingsRate: 35,
      monthlyNeto: 150,
      netWorthCurrent: 1020,
      netWorthBaseline: 1000,
      hasActiveEmergencyFund: true,
    })
    expect(result.score).toBe(100)
    expect(result.tier.label).toBe("Excelente")
    expect(result.factors).toEqual([
      { label: "Tasa de ahorro ≥ 20%", ok: true },
      { label: "Flujo del mes positivo", ok: true },
      { label: "Patrimonio en crecimiento", ok: true },
      { label: "Fondo de emergencia activo", ok: true },
    ])
  })

  it("puntúa 0 y Frágil cuando no se cumple ningún factor", () => {
    const result = getFinancialScore({
      savingsRate: 0,
      monthlyNeto: -150,
      netWorthCurrent: 980,
      netWorthBaseline: 1000,
      hasActiveEmergencyFund: false,
    })
    expect(result.score).toBe(0)
    expect(result.tier.label).toBe("Frágil")
    expect(result.factors.every((f) => !f.ok)).toBe(true)
  })

  it("usa una zona de transición en vez de un corte seco en 0 para flujo y crecimiento", () => {
    const result = getFinancialScore({
      savingsRate: 15,
      monthlyNeto: 0,
      netWorthCurrent: 1000,
      netWorthBaseline: 1000,
      hasActiveEmergencyFund: false,
    })
    // savingsRate 15/30*40=20, neto en el centro de su zona = 10, crecimiento en el centro de su zona = 10
    expect(result.score).toBe(40)
    expect(result.tier.label).toBe("Mejorable")
  })

  it("da el máximo de puntos de crecimiento si el patrimonio de referencia era 0 o negativo y el actual es positivo", () => {
    const result = getFinancialScore({
      savingsRate: 0,
      monthlyNeto: -150,
      netWorthCurrent: 500,
      netWorthBaseline: 0,
      hasActiveEmergencyFund: false,
    })
    expect(result.factors[2]).toEqual({ label: "Patrimonio en crecimiento", ok: true })
  })
})

describe("getFinancialTips", () => {
  it("detecta flujo de caja negativo del mes", () => {
    const txns = [
      tx({ tipo: "ingreso", monto: 100, fecha: "2026-06-01" }),
      tx({ tipo: "gasto", monto: 500, fecha: "2026-06-02" }),
    ]
    const tips = getFinancialTips(txns, [account()], [], "2026-06")
    expect(tips.some((t) => t.id === "cashflow-negative")).toBe(true)
  })

  it("detecta tasa de ahorro por debajo del 20%", () => {
    const txns = [
      tx({ tipo: "ingreso", monto: 1000, fecha: "2026-06-01" }),
      tx({ tipo: "gasto", monto: 950, fecha: "2026-06-02" }),
    ]
    const tips = getFinancialTips(txns, [account()], [], "2026-06")
    expect(tips.some((t) => t.id === "low-savings-rate")).toBe(true)
  })

  it("detecta patrimonio estancado 3 meses seguidos", () => {
    // Sin transacciones, el patrimonio (solo el saldo de la cuenta) no cambia
    // en ningún mes de la ventana.
    const tips = getFinancialTips([], [account({ saldo: 1000 })], [], "2026-06")
    expect(tips.some((t) => t.id === "net-worth-stagnant")).toBe(true)
  })

  it("detecta un pago recurrente que vence pronto sin fondos suficientes en la cuenta", () => {
    const today = new Date()
    const lastDue = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate() - 2)
    const fecha = lastDue.toISOString().slice(0, 10)
    const txns = [tx({ tags: ["recurrente"], categoria: "Alquiler", descripcion: "Piso", monto: 700, fecha })]
    const tips = getFinancialTips(txns, [account({ saldo: 100 })], [])
    expect(tips.some((t) => t.id.startsWith("recurring-risk-"))).toBe(true)
  })

  it("no avisa de un recurrente si la cuenta sí llega para cubrirlo", () => {
    const today = new Date()
    const lastDue = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate() - 2)
    const fecha = lastDue.toISOString().slice(0, 10)
    const txns = [tx({ tags: ["recurrente"], categoria: "Alquiler", descripcion: "Piso", monto: 700, fecha })]
    const tips = getFinancialTips(txns, [account({ saldo: 5000 })], [])
    expect(tips.some((t) => t.id.startsWith("recurring-risk-"))).toBe(false)
  })

  it("detecta una meta de ahorro con fecha límite próxima sin completar", () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 10)
    const funds = [fund({ cantidad_objetivo: 1000, ahorrado_actual: 200, fecha_limite: soon.toISOString().slice(0, 10) })]
    const tips = getFinancialTips([], [account()], funds)
    expect(tips.some((t) => t.id === "goal-deadline-fund_1")).toBe(true)
  })

  it("no genera ningún consejo cuando todo está en orden", () => {
    const txns = [
      tx({ tipo: "ingreso", monto: 2000, fecha: "2026-06-01" }),
      tx({ tipo: "gasto", monto: 500, fecha: "2026-06-02" }),
    ]
    const tips = getFinancialTips(txns, [account({ saldo: 5000 })], [], "2026-06")
    expect(tips).toHaveLength(0)
  })

  it("prioriza por severidad y respeta maxTips", () => {
    const txns = [
      tx({ tipo: "ingreso", monto: 100, fecha: "2026-06-01" }),
      tx({ tipo: "gasto", monto: 500, fecha: "2026-06-02" }), // flujo negativo -> critical
    ]
    const soon = new Date()
    soon.setDate(soon.getDate() + 10)
    const funds = [fund({ cantidad_objetivo: 1000, ahorrado_actual: 200, fecha_limite: soon.toISOString().slice(0, 10) })] // warning
    const tips = getFinancialTips(txns, [account({ saldo: 5000 })], funds, "2026-06", 1)
    expect(tips).toHaveLength(1)
    expect(tips[0].severity).toBe("critical")
  })
})
