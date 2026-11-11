// Categorización automática al importar extractos: primero lo que el usuario
// ya usó para un concepto parecido; si no, reglas por palabras clave.
// El resultado es una sugerencia: la UI siempre deja cambiarla.

import { similarDescription } from "@/lib/bank-import"

export type CategoryKind = "ingreso" | "gasto" | "both"
export type NamedCategory = { name: string; kind?: CategoryKind }
export type PastMovement = { descripcion: string; categoria: string; tipo: "ingreso" | "gasto" }
export type SuggestionSource = "learned" | "suggested" | "none"
export type CategorySuggestion = { category: string; source: SuggestionSource }

const GENERIC = new Set(["otros", "otros gastos", "otros ingresos", "saldo inicial", "ajuste de saldo", "transferencia"])

const RULES: { category: string; kind: "ingreso" | "gasto"; keywords: string[] }[] = [
  { category: "Supermercado", kind: "gasto", keywords: ["mercadona", "carrefour", "aldi", "lidl", "dia ", "el corte ingles alimentacion", "consum", "eroski", "alcampo", "hipercor", "ahorramas", "mas y mas"] },
  { category: "Restaurantes", kind: "gasto", keywords: ["mcdonald", "burger king", "kfc", "starbucks", "telepizza", "dominos", "just eat", "glovo", "uber eats", "restaurante", "cafeteria", "cafeter"] },
  { category: "Coche", kind: "gasto", keywords: ["repsol", "cepsa", "shell", " galp", "petronor", "bp ", "area de servicio", "estacion de servicio"] },
  { category: "Suministros", kind: "gasto", keywords: ["endesa", "iberdrola", "naturgy", "gas natural", "holaluz", "repsol luz"] },
  { category: "Hogar", kind: "gasto", keywords: ["ikea", "leroy merlin", "bauhaus", "bricomart"] },
  { category: "Internet", kind: "gasto", keywords: ["movistar", "vodafone", "orange", "yoigo", "jazztel", "masmovil", "digi "] },
  { category: "Móvil", kind: "gasto", keywords: ["movistar movil", "pepephone", "simyo"] },
  { category: "Suscripciones", kind: "gasto", keywords: ["netflix", "spotify", "amazon prime", "prime video", "disney+", "disney plus", "hbo", "max.com", "apple.com/bill", "youtube premium", "icloud"] },
  { category: "Ropa", kind: "gasto", keywords: ["zara", "mango", "h&m", "hm.com", "primark", "nike", "adidas", "zalando", "pull&bear", "bershka"] },
  { category: "Transporte", kind: "gasto", keywords: ["renfe", "metro ", "emt ", "cabify", "uber trip", "bolt.eu", "billete", "abono transporte"] },
  { category: "Salud", kind: "gasto", keywords: ["farmacia", "clinica", "hospital", "medico"] },
  { category: "Salario", kind: "ingreso", keywords: ["nomina", "payroll", "salario", "paga extra"] },
  { category: "Transferencia", kind: "gasto", keywords: ["bizum"] },
  { category: "Transferencia", kind: "ingreso", keywords: ["bizum"] },
]

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function available(name: string, names: Set<string>, aliases: Record<string, string>): string | null {
  if (names.has(name)) return name
  const alias = aliases[name]
  return alias && names.has(alias) ? alias : null
}

function pickLearned(description: string, tipo: "ingreso" | "gasto", history: PastMovement[]): string | null {
  const counts = new Map<string, number>()
  if (!description.trim()) return null
  for (const row of history) {
    if (row.tipo !== tipo) continue
    const cat = row.categoria.trim()
    if (!cat || GENERIC.has(cat.toLowerCase()) || !row.descripcion.trim()) continue
    if (!similarDescription(description, row.descripcion)) continue
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }
  let best: string | null = null
  let n = 0
  for (const [cat, c] of counts) {
    if (c > n) { best = cat; n = c }
  }
  return best
}

function pickKeyword(description: string, tipo: "ingreso" | "gasto"): string | null {
  const hay = ` ${norm(description)} `
  for (const rule of RULES) {
    if (rule.kind !== tipo) continue
    if (rule.keywords.some((k) => hay.includes(norm(k)))) return rule.category
  }
  return null
}

/** Propone una categoría. `names` son las del usuario; si no está la regla, se busca un alias (p. ej. Suministros → Hogar). */
export function suggestCategory(
  description: string,
  tipo: "ingreso" | "gasto",
  history: PastMovement[],
  categories: NamedCategory[],
): CategorySuggestion {
  const byKind = categories.filter((c) => !c.kind || c.kind === "both" || c.kind === tipo)
  const kindNames = new Set(byKind.map((c) => c.name))
  const aliases: Record<string, string> = {}
  if (!kindNames.has("Suministros") && kindNames.has("Hogar")) aliases.Suministros = "Hogar"
  if (!kindNames.has("Salario") && kindNames.has("Otros ingresos")) aliases.Salario = "Otros ingresos"
  if (!kindNames.has("Internet") && kindNames.has("Suministros")) aliases.Internet = "Suministros"
  if (!kindNames.has("Móvil") && kindNames.has("Suministros")) aliases.Móvil = "Suministros"

  const learned = pickLearned(description, tipo, history)
  if (learned && kindNames.has(learned)) return { category: learned, source: "learned" }

  const keyword = pickKeyword(description, tipo)
  if (keyword) {
    const name = available(keyword, kindNames, aliases)
    if (name) return { category: name, source: "suggested" }
  }

  const fallback = tipo === "ingreso"
    ? (kindNames.has("Otros ingresos") ? "Otros ingresos" : kindNames.has("Otros") ? "Otros" : [...kindNames][0] ?? "")
    : (kindNames.has("Otros gastos") ? "Otros gastos" : kindNames.has("Otros") ? "Otros" : [...kindNames][0] ?? "")
  return { category: fallback, source: "none" }
}
