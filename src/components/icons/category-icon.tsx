// Icono de categoría: se elige por palabras clave del nombre (sin tildes ni
// mayúsculas), con un icono genérico si no hay coincidencia. El relleno del
// duotono usa el color de la categoría, así se conserva el código de colores
// de siempre; el trazo sigue el color del texto.
import { createElement, type CSSProperties } from "react"
import type { Icon as PhosphorIcon } from "@phosphor-icons/react"
import {
  AirplaneTilt, ArrowsLeftRight, Baby, Bank, Barbell, BookOpen, Briefcase, Car, ChartLineUp, Coffee, Coins, Cpu, CreditCard,
  Drop, FilmSlate, FirstAid, ForkKnife, GameController, GasPump, Gift, GraduationCap, HandCoins, Heartbeat,
  House, Key, Laptop, Lightning, MusicNotes, Package, PawPrint, PiggyBank, Receipt, Repeat, Scissors,
  ShieldCheck, ShoppingBag, ShoppingCart, Storefront, Tag, Taxi, Television, Ticket, Train, TShirt, WifiHigh, Wrench,
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

export function categoryIconFor(name: string | null | undefined): PhosphorIcon {
  const n = normalize(name ?? "")
  for (const [re, icon] of RULES) if (re.test(n)) return icon
  return Tag
}

export function CategoryIcon({ name, color, className }: { name: string | null | undefined; color?: string | null; className?: string }) {
  const style = { "--cat-color": color || "var(--icon-accent)" } as CSSProperties
  // createElement: el icono es un componente estático elegido de la tabla RULES.
  return createElement(categoryIconFor(name), { weight: "duotone", size: 16, "aria-hidden": true, className: cn("app-icon app-icon-cat size-4 shrink-0", className), style })
}
