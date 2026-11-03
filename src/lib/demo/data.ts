import { localDateKey } from "../date-utils"
import { transferDescription } from "../transfer-description"

// Datos ficticios de la demo: unos 8 meses de una persona en España con
// nómina, alquiler, ahorro, fondo de emergencia, efectivo e indexados.
// Las fechas son relativas a hoy (siempre parece «al día») y todo sale de un
// generador con semilla fija: mismos datos en cada recarga.

type Row = Record<string, unknown>

export type DemoDatabase = {
  tables: Record<string, Row[]>
  settings: Record<string, string>
}

export const DEMO_ACCOUNT_IDS = {
  nomina: "demo_acc_nomina",
  ahorro: "demo_acc_ahorro",
  emergencia: "demo_acc_emergencia",
  inversion: "demo_acc_inversion",
  efectivo: "demo_acc_efectivo",
} as const

const ACCOUNTS = [
  { id: DEMO_ACCOUNT_IDS.nomina, nombre: "Cuenta nómina", tipo: "gastos", banco: "BBVA", currency: "EUR", objetivo: null, limite_mensual: 1500, color: "#3B82F6", start: 1840 },
  { id: DEMO_ACCOUNT_IDS.ahorro, nombre: "Ahorro", tipo: "ahorro", banco: "ING", currency: "EUR", objetivo: 15000, limite_mensual: null, color: "#2BD9A0", start: 6200 },
  { id: DEMO_ACCOUNT_IDS.emergencia, nombre: "Fondo de emergencia", tipo: "emergencia", banco: "Openbank", currency: "EUR", objetivo: 9000, limite_mensual: null, color: "#F5A524", start: 5400 },
  { id: DEMO_ACCOUNT_IDS.inversion, nombre: "Fondos indexados", tipo: "inversion", banco: "MyInvestor", currency: "EUR", objetivo: null, limite_mensual: null, color: "#8B5CF6", start: 7300 },
  { id: DEMO_ACCOUNT_IDS.efectivo, nombre: "Efectivo", tipo: "efectivo", banco: "", currency: "EUR", objetivo: null, limite_mensual: null, color: "#B08968", start: 120 },
] as const

const CATEGORIES: { name: string; kind: "ingreso" | "gasto" | "both"; color: string; icon: string }[] = [
  { name: "Salario", kind: "ingreso", color: "#2BD9A0", icon: "Briefcase" },
  { name: "Freelance", kind: "ingreso", color: "#14B8A6", icon: "Laptop" },
  { name: "Intereses", kind: "ingreso", color: "#84CC16", icon: "PiggyBank" },
  { name: "Reembolso", kind: "ingreso", color: "#38BDF8", icon: "HandCoins" },
  { name: "Venta", kind: "ingreso", color: "#FACC15", icon: "Storefront" },
  { name: "Rentabilidad", kind: "ingreso", color: "#8B5CF6", icon: "ChartLineUp" },
  { name: "Supermercado", kind: "gasto", color: "#F5A524", icon: "ShoppingCart" },
  { name: "Restaurantes", kind: "gasto", color: "#FF6B5B", icon: "ForkKnife" },
  { name: "Café", kind: "gasto", color: "#B08968", icon: "Coffee" },
  { name: "Alquiler", kind: "gasto", color: "#6366F1", icon: "House" },
  { name: "Suministros", kind: "gasto", color: "#FACC15", icon: "Lightning" },
  { name: "Internet", kind: "gasto", color: "#38BDF8", icon: "WifiHigh" },
  { name: "Móvil", kind: "gasto", color: "#3B82F6", icon: "DeviceMobile" },
  { name: "Suscripciones", kind: "gasto", color: "#C084FC", icon: "Television" },
  { name: "Transporte", kind: "gasto", color: "#14B8A6", icon: "Train" },
  { name: "Gym", kind: "gasto", color: "#E5484D", icon: "Barbell" },
  { name: "Ocio", kind: "gasto", color: "#F06292", icon: "Ticket" },
  { name: "Ropa", kind: "gasto", color: "#8B5CF6", icon: "TShirt" },
  { name: "Salud", kind: "gasto", color: "#FF8A3D", icon: "FirstAid" },
  { name: "Viajes", kind: "gasto", color: "#38BDF8", icon: "AirplaneTilt" },
  { name: "Regalos", kind: "gasto", color: "#F06292", icon: "Gift" },
  { name: "Hogar", kind: "gasto", color: "#8B95A5", icon: "Couch" },
  { name: "Transferencia", kind: "both", color: "#8B95A5", icon: "ArrowsLeftRight" },
  { name: "Otros", kind: "both", color: "#8B95A5", icon: "Tag" },
]

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g")
function categoryId(name: string) {
  return "cat_" + name.toLowerCase().normalize("NFD").replace(DIACRITICS, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

/** Generador pseudoaleatorio con semilla (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export const DEMO_MONTHS = 8

export function buildDemoDatabase(now: Date = new Date()): DemoDatabase {
  const rand = seeded(20261101)
  const between = (min: number, max: number) => round2(min + rand() * (max - min))
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]
  const today = localDateKey(now)
  const start = new Date(now.getFullYear(), now.getMonth() - (DEMO_MONTHS - 1), 1)

  const transactions: Row[] = []
  let seq = 0
  const nameOf = (id: string) => ACCOUNTS.find((a) => a.id === id)?.nombre ?? ""

  function add(cuenta: string, tipo: "ingreso" | "gasto", monto: number, fecha: string, categoria: string, descripcion: string, opts: { necesidad?: boolean; tags?: string[]; id?: string } = {}) {
    if (fecha > today) return
    seq += 1
    const hour = String(8 + (seq % 13)).padStart(2, "0")
    const minute = String((seq * 7) % 60).padStart(2, "0")
    transactions.push({
      id: opts.id ?? `demo_tx_${seq}`,
      cuenta_id: cuenta,
      monto: round2(monto),
      fecha,
      tipo,
      categoria,
      es_necesidad: opts.necesidad ?? false,
      descripcion,
      tags: opts.tags ?? [],
      created_at: `${fecha}T${hour}:${minute}:00.000Z`,
    })
  }

  function transfer(from: string, to: string, monto: number, fecha: string, label?: string) {
    if (fecha > today) return
    const pair = `demo_tr_${seq + 1}`
    const tags = ["traspaso", `traspaso:${pair}`]
    const descripcion = transferDescription(label, nameOf(from), nameOf(to))
    add(from, "gasto", monto, fecha, "Transferencia", descripcion, { tags })
    add(to, "ingreso", monto, fecha, "Transferencia", descripcion, { tags })
  }

  // Saldos de partida (el día 1 del primer mes).
  const startKey = localDateKey(start)
  for (const account of ACCOUNTS) {
    add(account.id, "ingreso", account.start, startKey, "Saldo inicial", `Saldo inicial de ${account.nombre}`, { id: `init_${account.id}` })
  }

  const { nomina, ahorro, emergencia, inversion, efectivo } = DEMO_ACCOUNT_IDS
  const supers = ["Mercadona", "Lidl", "Carrefour", "Dia", "Alcampo"] as const
  const restaurants = ["Cena con amigos", "Sushi", "Menú del día", "Pizzería", "Tapas", "Brunch"] as const
  const leisure = ["Cine", "Concierto", "Escape room", "Museo", "Pádel", "Entradas fútbol"] as const

  for (let m = 0; m < DEMO_MONTHS; m++) {
    const monthStart = new Date(start.getFullYear(), start.getMonth() + m, 1)
    const y = monthStart.getFullYear()
    const mo = monthStart.getMonth()
    const lastDay = new Date(y, mo + 1, 0).getDate()
    // Mes en curso: solo lo que ya habría pasado. Para que Inicio no se vea
    // vacío a primeros de mes, los cargos de la primera semana (alquiler,
    // abono, gimnasio, primera compra) se adelantan a hoy; la nómina y los
    // traspasos siguen llegando a final de mes, como en la realidad.
    const isCurrent = m === DEMO_MONTHS - 1
    const day = (d: number) => {
      const clamped = Math.min(d, lastDay)
      if (!isCurrent || clamped <= now.getDate()) return localDateKey(new Date(y, mo, clamped))
      return clamped <= 6 ? today : "9999-12-31"
    }
    const summer = mo === 6 || mo === 7
    const december = mo === 11

    // Ingresos: la nómina llega a final de mes (día 27 o 28), como en la
    // mayoría de empresas en España; junio y diciembre con paga extra.
    const extra = mo === 5 || mo === 11
    add(nomina, "ingreso", extra ? 4350 : 2350, day(27 + (m % 2)), "Salario", extra ? "Nómina + paga extra · Acme Software S.L." : "Nómina · Acme Software S.L.", extra ? {} : { tags: ["recurrente", "recurrente-dia:27"] })
    if (m % 2 === 1) add(nomina, "ingreso", between(280, 640), day(16), "Freelance", pick(["Diseño web cliente", "Consultoría", "Landing page"] as const))
    add(ahorro, "ingreso", between(7, 12), day(30), "Intereses", "Intereses cuenta remunerada")
    // Los indexados se revalorizan poco a poco (algún mes, menos).
    add(inversion, "ingreso", between(20, 140), day(24), "Rentabilidad", "Revalorización fondos indexados")
    if (m === 3) add(nomina, "ingreso", 64.9, day(21), "Reembolso", "Devolución Zalando")
    if (m === 5) add(nomina, "ingreso", 180, day(14), "Venta", "Venta bici en Wallapop")

    // Traspasos justo después de cobrar
    transfer(nomina, ahorro, 300, day(28 + (m % 2)), "Ahorro del mes")
    transfer(nomina, inversion, 250, day(28 + (m % 2)), "Aportación indexados")
    if (m % 2 === 0) transfer(nomina, emergencia, 150, day(29))
    if (m % 2 === 1) transfer(nomina, efectivo, 100, day(9), "Retirada cajero")

    // Gastos fijos
    add(nomina, "gasto", 850, day(1), "Alquiler", "Alquiler piso", { necesidad: true, tags: ["recurrente"] })
    add(nomina, "gasto", between(48, 92), day(8), "Suministros", "Iberdrola luz y gas", { necesidad: true, tags: ["recurrente"] })
    add(nomina, "gasto", 30, day(10), "Internet", "Digi fibra", { necesidad: true, tags: ["recurrente"] })
    add(nomina, "gasto", 15, day(12), "Móvil", "Tarifa móvil", { necesidad: true, tags: ["recurrente"] })
    add(nomina, "gasto", 11.99, day(15), "Suscripciones", "Spotify", { tags: ["recurrente"] })
    add(nomina, "gasto", 13.99, day(16), "Suscripciones", "Netflix", { tags: ["recurrente"] })
    add(nomina, "gasto", 39.9, day(5), "Gym", "Cuota gimnasio", { tags: ["recurrente"] })
    add(nomina, "gasto", 20, day(4), "Transporte", "Abono transporte", { necesidad: true, tags: ["recurrente"] })

    // Gastos variables
    const shops = 4 + Math.floor(rand() * 3)
    for (let i = 0; i < shops; i++) add(nomina, "gasto", between(32, 96), day(2 + Math.floor((i * 27) / shops) + Math.floor(rand() * 3)), "Supermercado", pick(supers), { necesidad: true })
    const meals = 2 + Math.floor(rand() * 3)
    for (let i = 0; i < meals; i++) add(nomina, "gasto", between(16, 58), day(5 + Math.floor(rand() * 24)), "Restaurantes", pick(restaurants))
    const coffees = 3 + Math.floor(rand() * 3)
    for (let i = 0; i < coffees; i++) add(efectivo, "gasto", between(1.8, 4.5), day(2 + Math.floor(rand() * 26)), "Café", pick(["Café con leche", "Café y tostada", "Cortado"] as const))
    add(nomina, "gasto", between(14, 45), day(19), "Ocio", pick(leisure))
    if (rand() > 0.4) add(nomina, "gasto", between(12, 38), day(25), "Ocio", pick(leisure))
    if (m % 3 === 1) add(nomina, "gasto", between(35, 89), day(22), "Ropa", pick(["Zara", "Decathlon", "Uniqlo"] as const))
    if (m % 4 === 2) add(nomina, "gasto", between(25, 70), day(11), "Salud", pick(["Farmacia", "Fisioterapia", "Dentista revisión"] as const), { necesidad: true })
    if (m % 3 === 0) add(nomina, "gasto", between(9, 45), day(13), "Transporte", pick(["Gasolina", "Cabify", "Renfe"] as const))
    if (m % 4 === 3) add(nomina, "gasto", between(29, 120), day(17), "Hogar", pick(["IKEA", "Leroy Merlin", "Amazon hogar"] as const))
    if (summer) add(nomina, "gasto", between(380, 520), day(12), "Viajes", "Vuelos y hotel vacaciones")
    if (december) add(nomina, "gasto", between(140, 220), day(20), "Regalos", "Regalos de Navidad")
    if (m === DEMO_MONTHS - 3) add(nomina, "gasto", 249, day(7), "Viajes", "Escapada a Lisboa")
  }

  // Saldos = suma del histórico (así no hace falta ningún ajuste).
  const accounts: Row[] = ACCOUNTS.map((account) => {
    const saldo = transactions
      .filter((t) => t.cuenta_id === account.id)
      .reduce((sum, t) => sum + (t.tipo === "ingreso" ? Number(t.monto) : -Number(t.monto)), 0)
    return {
      id: account.id, nombre: account.nombre, tipo: account.tipo, banco: account.banco, saldo: round2(saldo),
      currency: account.currency, objetivo: account.objetivo, limite_mensual: account.limite_mensual, color: account.color, logo_url: null,
    }
  })

  const categories: Row[] = CATEGORIES.map((c) => ({ id: categoryId(c.name), name: c.name, color: c.color, kind: c.kind, icon: c.icon }))

  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const budgets: Row[] = [
    { name: "Supermercado", amount: 380 },
    { name: "Restaurantes", amount: 150 },
    { name: "Ocio", amount: 90 },
    { name: "Ropa", amount: 80 },
  ].map((b) => ({ id: `demo_budget_${categoryId(b.name)}`, category_id: categoryId(b.name), amount: b.amount, month }))

  const inMonths = (n: number) => localDateKey(new Date(now.getFullYear(), now.getMonth() + n, 15))
  const sinkingFunds: Row[] = [
    { id: "demo_meta_japon", nombre: "Viaje a Japón", objetivo: 3500, ahorrado: 2150, fecha_limite: inMonths(7), cuenta_id: ahorro },
    { id: "demo_meta_coche", nombre: "Entrada del coche", objetivo: 6000, ahorrado: 2400, fecha_limite: inMonths(16), cuenta_id: ahorro },
    { id: "demo_meta_portatil", nombre: "Portátil nuevo", objetivo: 1200, ahorrado: 950, fecha_limite: inMonths(2), cuenta_id: ahorro },
  ]

  const wealthGoals: Row[] = [
    { id: "demo_goal_1", amount: 20000, name: "Primeros 20.000 €" },
    { id: "demo_goal_2", amount: 30000, name: "Colchón y entrada" },
    { id: "demo_goal_3", amount: 50000, name: "Medio camino" },
    { id: "demo_goal_4", amount: 100000, name: "Los primeros 100k" },
  ]

  const invStart = localDateKey(start)
  const investments: Row[] = [
    { id: "demo_pos_world", kind: "fund", symbol: "DEMO-MSCIWORLD", name: "Fondo indexado MSCI World", isin: null, date: invStart, units: 212.4, buy_price: 30.1, currency: "EUR", account_id: inversion, asset_class: "fondos_indexados", dca: true, dca_amount: 200, dca_freq: "monthly", dca_last: null },
    { id: "demo_pos_em", kind: "fund", symbol: "DEMO-EMERGING", name: "Fondo indexado Emergentes", isin: null, date: invStart, units: 118.6, buy_price: 14.2, currency: "EUR", account_id: inversion, asset_class: "fondos_indexados", dca: true, dca_amount: 50, dca_freq: "monthly", dca_last: null },
  ]
  const contributions: Row[] = investments.map((p) => ({ id: `demo_contrib_${p.id}`, position_id: p.id, amount: round2(Number(p.units) * Number(p.buy_price)), date: invStart }))

  return {
    tables: {
      accounts,
      transactions,
      sinking_funds: sinkingFunds,
      categories,
      budgets,
      wealth_goals: wealthGoals,
      investments,
      investment_contributions: contributions,
      watchlist: [
        { symbol: "DEMO-MSCIWORLD", name: "Fondo indexado MSCI World" },
        { symbol: "DEMO-SP500", name: "Fondo indexado S&P 500" },
      ],
    },
    settings: {
      onboarding: "dismissed",
      "income-target": "2600",
    },
  }
}

/** Precios ficticios para las posiciones de la demo (sin llamar a internet). */
export const DEMO_QUOTES: Record<string, { price: number; name: string; changePct: number }> = {
  "DEMO-MSCIWORLD": { price: 33.86, name: "Fondo indexado MSCI World", changePct: 0.42 },
  "DEMO-EMERGING": { price: 15.02, name: "Fondo indexado Emergentes", changePct: -0.31 },
  "DEMO-SP500": { price: 41.37, name: "Fondo indexado S&P 500", changePct: 0.58 },
}
