// Icono de categoría: se elige por palabras clave del nombre (sin tildes ni
// mayúsculas), con un icono genérico si no hay coincidencia. El relleno del
// duotono usa el color de la categoría, así se conserva el código de colores
// de siempre; el trazo sigue el color del texto.
import { createElement, type CSSProperties } from "react"
import type { Icon as PhosphorIcon } from "@phosphor-icons/react"
import {
  AirplaneTilt, ArrowsLeftRight, Baby, Bank, Barbell, BeerStein, Bicycle, BookOpen, Briefcase, Broom, Bus, Cake, Car, Cat, ChartLineUp,
  Cigarette, Coffee, Coins, Confetti, Couch, Cpu, CreditCard, DeviceMobile, Dog, Dress, Drop, FilmSlate, FirstAid, Flame, ForkKnife,
  GameController, GasPump, Gift, GraduationCap, Hamburger, Hammer, HandCoins, Heart, Heartbeat, House, Key, Laptop, Lightning, Money,
  MusicNotes, Package, PawPrint, PiggyBank, Pill, Pizza, Plant, Receipt, Repeat, Scissors, ShieldCheck, ShoppingBag, ShoppingCart,
  Sneaker, SoccerBall, Sparkle, Storefront, Suitcase, Tag, Taxi, Television, Ticket, Tooth, Train, Tree, TShirt, Umbrella, WifiHigh,
  Wine, Wrench,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "@/lib/utils"

const RULES: [RegExp, PhosphorIcon][] = [
  [/salari|nomina|sueldo|paga\b/, Briefcase],
  [/freelance|autonom|proyecto/, Laptop],
  [/negocio|venta|tienda/, Storefront],
  [/dividend|inversi|bolsa|etf|cripto/, ChartLineUp],
  [/interes/, Coins],
  [/renta(s)?\b|alquiler cobrado/, Key],
  [/reembolso|devoluc/, HandCoins],
  [/regalo|cumple/, Gift],
  [/bonus|prima|extra/, Coins],
  [/ahorro|hucha/, PiggyBank],
  [/super|mercado|compra|aliment/, ShoppingCart],
  [/restaur|cena|comida|almuerzo|menu|delivery|glovo|uber eats/, ForkKnife],
  [/cafe|bar\b|copas/, Coffee],
  [/gasolina|combustible/, GasPump],
  [/coche|parking|peaje|itv/, Car],
  [/taxi|cabify|uber/, Taxi],
  [/tren|metro|bus|transporte|abono/, Train],
  [/alquiler|hipoteca/, Key],
  [/vivienda|casa|hogar|comunidad/, House],
  [/luz|electric|energia/, Lightning],
  [/agua/, Drop],
  [/internet|movil|telefon|fibra/, WifiHigh],
  [/suscrip|netflix|spotify|hbo|disney|streaming/, Television],
  [/recibo|factura|impuesto|hacienda|tasa/, Receipt],
  [/seguro/, ShieldCheck],
  [/banco|comision/, Bank],
  [/tarjeta|credito|deuda|prestamo/, CreditCard],
  [/ocio|entrada|evento|concierto/, Ticket],
  [/cine|serie/, FilmSlate],
  [/musica/, MusicNotes],
  [/juego|videojuego|gaming/, GameController],
  [/salud|medic|farmacia|dentista|medico/, Heartbeat],
  [/gimnasio|gym|deporte/, Barbell],
  [/belleza|peluquer/, Scissors],
  [/ropa|moda|zapat/, TShirt],
  [/viaje|vacacion|vuelo|hotel/, AirplaneTilt],
  [/formacion|educacion|curso|estudio|universidad/, GraduationCap],
  [/libro|lectura/, BookOpen],
  [/mascota|perro|gato|veterin/, PawPrint],
  [/bebe|hijo|niño|nino|guarderia/, Baby],
  [/primeros auxilios|emergencia/, FirstAid],
  [/reparac|mantenim|bricolaje/, Wrench],
  [/amazon|online|paquete|envio/, Package],
  [/shopping|caprichos|deseo/, ShoppingBag],
  [/recurrente|cuota/, Repeat],
  [/tecnolog|electronica|ordenador/, Cpu],
  [/transferencia|traspaso/, ArrowsLeftRight],
]

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/** Iconos que el usuario puede elegir para una categoría (se guarda la clave). */
export const CATEGORY_ICON_CHOICES: { key: string; icon: PhosphorIcon; label: string; words: string }[] = [
  { key: "ShoppingCart", icon: ShoppingCart, label: "Supermercado", words: "compra mercado comida" },
  { key: "ForkKnife", icon: ForkKnife, label: "Restaurante", words: "comer cena menu" },
  { key: "Coffee", icon: Coffee, label: "Café", words: "cafeteria desayuno bar" },
  { key: "Hamburger", icon: Hamburger, label: "Comida rápida", words: "burger delivery" },
  { key: "Pizza", icon: Pizza, label: "Pizza", words: "comida a domicilio" },
  { key: "Wine", icon: Wine, label: "Vino", words: "copas cena bebida" },
  { key: "BeerStein", icon: BeerStein, label: "Cerveza", words: "bar copas fiesta" },
  { key: "Cake", icon: Cake, label: "Tarta", words: "cumpleaños celebracion" },
  { key: "Car", icon: Car, label: "Coche", words: "parking itv taller" },
  { key: "GasPump", icon: GasPump, label: "Gasolina", words: "combustible" },
  { key: "Taxi", icon: Taxi, label: "Taxi", words: "uber cabify" },
  { key: "Train", icon: Train, label: "Tren", words: "metro transporte" },
  { key: "Bus", icon: Bus, label: "Autobús", words: "transporte abono" },
  { key: "Bicycle", icon: Bicycle, label: "Bici", words: "patinete" },
  { key: "AirplaneTilt", icon: AirplaneTilt, label: "Viajes", words: "vuelo avion vacaciones" },
  { key: "Suitcase", icon: Suitcase, label: "Maleta", words: "viaje hotel vacaciones" },
  { key: "House", icon: House, label: "Casa", words: "hogar vivienda comunidad" },
  { key: "Key", icon: Key, label: "Alquiler", words: "hipoteca llave" },
  { key: "Couch", icon: Couch, label: "Muebles", words: "decoracion hogar" },
  { key: "Broom", icon: Broom, label: "Limpieza", words: "hogar casa" },
  { key: "Lightning", icon: Lightning, label: "Luz", words: "electricidad energia" },
  { key: "Drop", icon: Drop, label: "Agua", words: "suministro" },
  { key: "Flame", icon: Flame, label: "Gas", words: "calefaccion" },
  { key: "WifiHigh", icon: WifiHigh, label: "Internet", words: "fibra wifi" },
  { key: "DeviceMobile", icon: DeviceMobile, label: "Móvil", words: "telefono" },
  { key: "Television", icon: Television, label: "Suscripciones", words: "netflix streaming tv" },
  { key: "Receipt", icon: Receipt, label: "Recibos", words: "factura impuestos" },
  { key: "ShieldCheck", icon: ShieldCheck, label: "Seguros", words: "seguro" },
  { key: "Bank", icon: Bank, label: "Banco", words: "comisiones" },
  { key: "CreditCard", icon: CreditCard, label: "Tarjeta", words: "deuda prestamo credito" },
  { key: "Coins", icon: Coins, label: "Monedas", words: "intereses extra" },
  { key: "Money", icon: Money, label: "Dinero", words: "efectivo billetes" },
  { key: "PiggyBank", icon: PiggyBank, label: "Ahorro", words: "hucha" },
  { key: "ChartLineUp", icon: ChartLineUp, label: "Inversión", words: "bolsa dividendos" },
  { key: "Briefcase", icon: Briefcase, label: "Trabajo", words: "salario nomina sueldo" },
  { key: "Laptop", icon: Laptop, label: "Freelance", words: "ordenador proyecto" },
  { key: "Storefront", icon: Storefront, label: "Negocio", words: "tienda ventas" },
  { key: "HandCoins", icon: HandCoins, label: "Cobros", words: "reembolso devolucion" },
  { key: "Gift", icon: Gift, label: "Regalos", words: "cumpleaños navidad" },
  { key: "Confetti", icon: Confetti, label: "Fiestas", words: "celebracion eventos" },
  { key: "Heart", icon: Heart, label: "Pareja", words: "amor donaciones" },
  { key: "Heartbeat", icon: Heartbeat, label: "Salud", words: "medico" },
  { key: "FirstAid", icon: FirstAid, label: "Emergencias", words: "botiquin" },
  { key: "Pill", icon: Pill, label: "Farmacia", words: "medicinas" },
  { key: "Tooth", icon: Tooth, label: "Dentista", words: "dental" },
  { key: "Barbell", icon: Barbell, label: "Gimnasio", words: "deporte gym" },
  { key: "SoccerBall", icon: SoccerBall, label: "Deporte", words: "futbol padel" },
  { key: "Scissors", icon: Scissors, label: "Peluquería", words: "belleza estetica" },
  { key: "Sparkle", icon: Sparkle, label: "Belleza", words: "cosmetica cuidado" },
  { key: "TShirt", icon: TShirt, label: "Ropa", words: "moda" },
  { key: "Dress", icon: Dress, label: "Moda", words: "ropa vestido" },
  { key: "Sneaker", icon: Sneaker, label: "Zapatos", words: "calzado" },
  { key: "ShoppingBag", icon: ShoppingBag, label: "Compras", words: "caprichos shopping" },
  { key: "Package", icon: Package, label: "Paquetes", words: "amazon online envios" },
  { key: "Baby", icon: Baby, label: "Bebé", words: "hijos niños guarderia" },
  { key: "GraduationCap", icon: GraduationCap, label: "Formación", words: "educacion curso universidad colegio" },
  { key: "BookOpen", icon: BookOpen, label: "Libros", words: "lectura" },
  { key: "PawPrint", icon: PawPrint, label: "Mascotas", words: "veterinario" },
  { key: "Dog", icon: Dog, label: "Perro", words: "mascota" },
  { key: "Cat", icon: Cat, label: "Gato", words: "mascota" },
  { key: "Ticket", icon: Ticket, label: "Ocio", words: "entradas eventos concierto" },
  { key: "FilmSlate", icon: FilmSlate, label: "Cine", words: "series peliculas" },
  { key: "MusicNotes", icon: MusicNotes, label: "Música", words: "conciertos" },
  { key: "GameController", icon: GameController, label: "Videojuegos", words: "juegos gaming" },
  { key: "Cpu", icon: Cpu, label: "Tecnología", words: "electronica gadgets" },
  { key: "Wrench", icon: Wrench, label: "Reparaciones", words: "mantenimiento taller" },
  { key: "Hammer", icon: Hammer, label: "Bricolaje", words: "obras herramientas" },
  { key: "Plant", icon: Plant, label: "Plantas", words: "jardin" },
  { key: "Tree", icon: Tree, label: "Naturaleza", words: "excursion" },
  { key: "Umbrella", icon: Umbrella, label: "Imprevistos", words: "colchon" },
  { key: "Cigarette", icon: Cigarette, label: "Tabaco", words: "vicios" },
  { key: "Repeat", icon: Repeat, label: "Cuotas", words: "recurrente" },
  { key: "ArrowsLeftRight", icon: ArrowsLeftRight, label: "Traspasos", words: "transferencia" },
  { key: "Tag", icon: Tag, label: "Otros", words: "general varios" },
]
const CHOICE_BY_KEY = new Map(CATEGORY_ICON_CHOICES.map((c) => [c.key, c.icon]))

export function isCategoryIconKey(key: unknown): key is string {
  return typeof key === "string" && CHOICE_BY_KEY.has(key)
}

/** Busca iconos por nombre o palabras clave (sin tildes). */
export function searchCategoryIcons(query: string) {
  const q = normalize(query.trim())
  if (!q) return CATEGORY_ICON_CHOICES
  return CATEGORY_ICON_CHOICES.filter((c) => normalize(`${c.label} ${c.words} ${c.key}`).includes(q))
}

// Iconos elegidos por el usuario, por nombre de categoría. Lo rellena
// FinanceProvider cada vez que cambian las categorías: así cualquier
// <CategoryIcon name="…"> (movimientos, presupuestos, gráficos) muestra el
// icono elegido sin tener que pasar la categoría completa por todas partes.
let chosenByName = new Map<string, string>()
export function registerCategoryIcons(categories: { name: string; icon?: string | null }[]) {
  const next = new Map<string, string>()
  for (const c of categories) if (isCategoryIconKey(c.icon)) next.set(normalize(c.name.trim()), c.icon)
  chosenByName = next
}

/** Icono automático según el nombre (sin tener en cuenta el elegido). */
export function autoCategoryIconFor(name: string | null | undefined): PhosphorIcon {
  const n = normalize(name ?? "")
  for (const [re, icon] of RULES) if (re.test(n)) return icon
  return Tag
}

export function categoryIconFor(name: string | null | undefined, icon?: string | null): PhosphorIcon {
  if (isCategoryIconKey(icon)) return CHOICE_BY_KEY.get(icon)!
  const chosen = chosenByName.get(normalize((name ?? "").trim()))
  if (chosen) return CHOICE_BY_KEY.get(chosen)!
  return autoCategoryIconFor(name)
}

export function CategoryIcon({ name, icon, color, className }: { name: string | null | undefined; icon?: string | null; color?: string | null; className?: string }) {
  const style = { "--cat-color": color || "var(--icon-accent)" } as CSSProperties
  // createElement: el icono es un componente estático de la tabla de iconos.
  return createElement(categoryIconFor(name, icon), { weight: "duotone", size: 16, "aria-hidden": true, className: cn("app-icon app-icon-cat size-4 shrink-0", className), style })
}
