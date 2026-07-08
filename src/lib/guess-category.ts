// Autocategorización por palabra clave en la descripción — usada por
// /api/shortcuts/movement para que un gasto/ingreso creado desde el Atajo no
// caiga siempre en "Otros". Los nombres de categoría usados aquí son los de
// DEFAULT_CATEGORY_DEFS en store.tsx, que mergeDefaultCategories() garantiza
// que siempre existen. Si ninguna regla acierta, se mantiene "Otros".
const GASTO_CATEGORIAS: [RegExp, string][] = [
  [/mercadona|carrefour|lidl|super(mercado)?|d[ií]a\b|alcampo/i, "Supermercado"],
  [/restaurante|almuerzo|men[uú] del d[ií]a/i, "Restaurantes"],
  [/café|cafe|desayuno/i, "Restaurantes"],
  [/\bcena\b/i, "Cena"],
  [/uber|cabify|taxi|\bbus\b|metro|\btren\b|gasolina|parking|autob[uú]s/i, "Transporte"],
  [/coche|taller|\bitv\b|neum[aá]tico/i, "Coche"],
  [/alquiler|renta mensual/i, "Alquiler"],
  [/\bluz\b|\bagua\b|\bgas\b|suministro/i, "Suministros"],
  [/internet|fibra|r[oó]uter/i, "Internet"],
  [/m[oó]vil|tel[eé]fono/i, "Móvil"],
  [/spotify/i, "Spotify"],
  [/netflix|hbo|disney\+?|prime video|suscripci[oó]n/i, "Suscripciones"],
  [/cine|\bbar\b|copas?|discoteca|concierto/i, "Ocio"],
  [/ropa|zapatillas|zapatos/i, "Ropa"],
  [/farmacia|m[eé]dico|dentista|cl[ií]nica/i, "Salud"],
  [/gimnasio|\bgym\b/i, "Gym"],
  [/curso|\blibro\b|matr[ií]cula/i, "Educación"],
  [/vuelo|hotel|\bviaje\b|airbnb/i, "Viajes"],
  [/veterinari|mascota/i, "Mascotas"],
  [/\bregalo\b/i, "Regalos"],
  [/impuesto|hacienda|\btasa\b/i, "Impuestos"],
]

const INGRESO_CATEGORIAS: [RegExp, string][] = [
  [/n[oó]mina|salario/i, "Salario"],
  [/freelance/i, "Freelance"],
  [/dividendo/i, "Dividendos"],
  [/inter[eé]s/i, "Intereses"],
  [/reembolso|devoluci[oó]n/i, "Reembolso"],
  [/\bregalo\b/i, "Regalo"],
  [/venta|wallapop|vinted/i, "Venta"],
  [/bonus|paga extra/i, "Bonus"],
]

export function guessCategory(descripcion: string, tipo: "gasto" | "ingreso"): string {
  const rules = tipo === "gasto" ? GASTO_CATEGORIAS : INGRESO_CATEGORIAS
  for (const [re, categoria] of rules) {
    if (re.test(descripcion)) return categoria
  }
  return "Otros"
}
