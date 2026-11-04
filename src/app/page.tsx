import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { CalendarDots, CaretDown, ChartLineUp, DeviceMobile, FileArrowUp, PlayCircle, Scales, ShieldCheck, Sparkle } from "@phosphor-icons/react/dist/ssr"
import { GarraMark } from "@/components/brand/garra-logo"

// Portada pública (sin sesión). Con sesión, src/proxy.ts manda directo a
// /dashboard antes de renderizar nada, así que no hay parpadeo.
const TITLE = "Garra · Tus finanzas personales, claras y en un solo sitio"
const DESCRIPTION = "Junta tus cuentas, gastos, inversiones, bienes y deudas para saber cuánto tienes de verdad. Gratis, sin conectar tu banco. Pruébala sin registrarte."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://www.migarra.app/" },
  openGraph: { type: "website", url: "https://www.migarra.app/", siteName: "Garra", title: TITLE, description: DESCRIPTION, locale: "es_ES" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
}

const SIGNUP = "/login?modo=registro"
const FEATURES = [
  { icon: Scales, title: "Patrimonio completo", text: "Cuentas, inversiones, vivienda, coche y deudas como la hipoteca: tu patrimonio neto real en una cifra." },
  { icon: ChartLineUp, title: "Inversiones", text: "Fondos y acciones con su ganancia, tus aportaciones periódicas y en qué está invertido tu dinero." },
  { icon: CalendarDots, title: "Gastos fijos", text: "Alquiler, nómina, suscripciones y cuotas en una agenda que te avisa antes de cada pago." },
  { icon: FileArrowUp, title: "Importa del banco", text: "Sube el CSV de tu banco y elige qué movimientos guardar. El archivo se lee en tu dispositivo." },
  { icon: DeviceMobile, title: "Atajo del iPhone", text: "Apunta un gasto en dos toques desde el iPhone, sin abrir la app." },
  { icon: ShieldCheck, title: "Privado por diseño", text: "No te pedimos las claves del banco, no vendemos datos y puedes ocultar las cifras con un toque." },
]
const STEPS = [
  { title: "Crea tu cuenta", text: "Solo necesitas un email. Gratis." },
  { title: "Añade tus cuentas", text: "Pon el saldo de cada una o importa los movimientos del banco en CSV." },
  { title: "Apunta y revisa", text: "Apunta gastos desde el móvil o el atajo del iPhone y mira cómo vas cada mes." },
]
const FAQ = [
  { q: "¿Es gratis?", a: "Sí. Puedes crear tu cuenta y usar Garra sin pagar. Si algún día hay funciones de pago, te lo diremos antes y lo que ya usas seguirá funcionando." },
  { q: "¿Mis datos están seguros?", a: "Tus datos se guardan en servidores de la Unión Europea y solo tu cuenta puede verlos. Garra no se conecta a tu banco ni te pide sus claves. Puedes exportarlo todo o borrar tu cuenta cuando quieras." },
  { q: "¿Funciona en el móvil?", a: "Sí. Garra está pensada para el móvil y el ordenador, y puedes añadirla a la pantalla de inicio como una app." },
  { q: "¿Puedo probarla sin registrarme?", a: "Sí: la demo usa datos ficticios, puedes tocarlo todo y nada se guarda." },
]

const BTN = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold transition-[filter,transform] active:scale-[0.98]"
const PRI = `${BTN} bg-[#F5A524] text-[#0B0F14] shadow-[0_10px_30px_-10px_#F5A52499] hover:brightness-110`
const SEC = `${BTN} border border-[#232B36] bg-white/[0.03] text-[#EEF1F4] hover:bg-white/[0.07]`
const CARD = "rounded-[18px] border border-[#232B36] bg-[#151B23]"
const SHOT = "overflow-hidden rounded-[18px] border border-[#232B36] bg-[#151B23] shadow-[0_30px_80px_-30px_#000,0_0_0_1px_#F5A52422]"

function Shot({ src, alt, w, h, caption, priority }: { src: string; alt: string; w: number; h: number; caption?: React.ReactNode; priority?: boolean }) {
  return (
    <figure className={SHOT}>
      <Image src={src} alt={alt} width={w} height={h} priority={priority} sizes="(max-width: 820px) 100vw, 700px" className="block h-auto w-full" />
      {caption && <figcaption className="border-t border-[#232B36] px-4 py-2.5 text-[13px] text-[#8C96A3]">{caption}</figcaption>}
    </figure>
  )
}

export default function Landing() {
  return (
    <div className="min-h-dvh bg-[#0B0F14] text-[#EEF1F4] [color-scheme:dark]">
      <div className="mx-auto max-w-[1180px] px-5">
        <nav className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-extrabold"><GarraMark className="size-8" />Garra</Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden min-h-10 items-center rounded-full border border-[#232B36] px-4 text-sm font-semibold hover:bg-white/[0.06] sm:inline-flex">Entrar</Link>
            <Link href={SIGNUP} className="inline-flex min-h-10 items-center rounded-full bg-[#F5A524] px-4 text-sm font-bold text-[#0B0F14] hover:brightness-110">Crear cuenta</Link>
          </div>
        </nav>

        <header className="grid items-center gap-10 pb-10 pt-6 lg:grid-cols-[1fr_1.1fr] lg:pt-14">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F5A52440] bg-[#F5A5241a] px-3 py-1 text-[13px] font-bold text-[#F5A524]"><Sparkle weight="duotone" className="size-4" />Gratis · en beta</span>
            <h1 className="my-4 text-[2.4rem] font-extrabold leading-[1.05] tracking-tight sm:text-[3.5rem]">Todo tu dinero, <span className="text-[#F5A524]">claro</span> y en un solo sitio.</h1>
            <p className="max-w-[520px] text-[17px] text-[#C3CAD3] sm:text-[19px]">Garra junta tus cuentas, gastos, inversiones, bienes y deudas para que sepas cuánto tienes de verdad y a dónde va cada euro. Sin conectar tu banco.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className={PRI}><PlayCircle weight="duotone" className="size-5" />Probar la demo sin cuenta</Link>
              <Link href={SIGNUP} className={SEC}>Crear cuenta gratis</Link>
            </div>
            <p className="mt-3 text-[13px] text-[#8C96A3]">La demo usa datos ficticios: toca lo que quieras, nada se guarda.</p>
          </div>
          <div className="relative pb-6 pr-2">
            <Shot src="/landing/inicio.webp" alt="Inicio de Garra con el patrimonio total, el resumen del mes y el gráfico de ingresos y gastos" w={1440} h={900} priority />
            <div className="absolute -bottom-2 right-0 w-[26%] min-w-[96px] overflow-hidden rounded-[22px] border-[5px] border-[#1d242e] shadow-2xl">
              <Image src="/landing/movil.webp" alt="Garra en el móvil" width={390} height={844} sizes="160px" className="block h-auto w-full" />
            </div>
          </div>
        </header>
      </div>

      <section className="py-14" aria-labelledby="funciones">
        <div className="mx-auto max-w-[1180px] px-5">
          <h2 id="funciones" className="text-[1.75rem] font-extrabold tracking-tight sm:text-4xl">Lo que puedes hacer con Garra</h2>
          <p className="mb-7 mt-1 text-[17px] text-[#8C96A3]">Pensada para llevar tus finanzas personales sin hojas de cálculo.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className={`${CARD} p-6`}>
                <Icon weight="duotone" className="size-8 text-[#F5A524]" />
                <h3 className="mb-1.5 mt-3 text-lg font-bold">{title}</h3>
                <p className="text-[15px] text-[#8C96A3]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14" aria-labelledby="capturas">
        <div className="mx-auto max-w-[1180px] px-5">
          <h2 id="capturas" className="text-[1.75rem] font-extrabold tracking-tight sm:text-4xl">Así se ve por dentro</h2>
          <p className="mb-7 mt-1 text-[17px] text-[#8C96A3]">Capturas reales de la demo.</p>
          <div className="grid items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Shot src="/landing/grafico.webp" alt="Gráfico de ingresos y gastos de los últimos meses" w={1200} h={548} caption={<>Ingresos <span className="text-[#2BD9A0]">verde</span>, gastos <span className="text-[#FF6B5B]">rojo</span> y ahorro mes a mes.</>} />
            <div className="grid gap-4">
              <Shot src="/landing/patrimonio.webp" alt="Patrimonio con bienes y deudas" w={1200} h={476} caption="Patrimonio con bienes y deudas." />
              <Shot src="/landing/agenda.webp" alt="Agenda de gastos fijos" w={1200} h={714} caption="Gastos fijos y próximos pagos." />
            </div>
          </div>
        </div>
      </section>

      <section className="py-14" aria-labelledby="pasos">
        <div className="mx-auto max-w-[1180px] px-5">
          <h2 id="pasos" className="text-[1.75rem] font-extrabold tracking-tight sm:text-4xl">Empieza en 3 pasos</h2>
          <p className="mb-7 mt-1 text-[17px] text-[#8C96A3]">En unos minutos tienes tu primera foto financiera.</p>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`${CARD} p-6`}>
                <span className="mb-3 grid size-10 place-items-center rounded-xl bg-[#F5A5241f] text-lg font-bold text-[#F5A524]">{i + 1}</span>
                <h3 className="mb-1.5 text-lg font-bold">{s.title}</h3>
                <p className="text-[#8C96A3]">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-14" aria-labelledby="faq">
        <div className="mx-auto max-w-[820px] px-5">
          <h2 id="faq" className="text-[1.75rem] font-extrabold tracking-tight sm:text-4xl">Preguntas frecuentes</h2>
          <p className="mb-7 mt-1 text-[17px] text-[#8C96A3]">Lo que suele preguntar la gente antes de empezar.</p>
          {FAQ.map((f) => (
            <details key={f.q} className={`${CARD} group mb-2.5 rounded-[14px] px-5 py-4`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden">{f.q}<CaretDown weight="bold" className="size-4 shrink-0 text-[#8C96A3] transition-transform group-open:rotate-180" /></summary>
              <p className="mt-2.5 text-[#8C96A3]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-[1180px] px-5">
          <div className="rounded-[24px] border border-[#F5A52433] bg-gradient-to-br from-[#1A1610] to-[#151B23] px-5 py-12 text-center">
            <h2 className="text-[1.75rem] font-extrabold tracking-tight sm:text-4xl">Pruébala ahora, sin registrarte</h2>
            <p className="mb-6 mt-1 text-[17px] text-[#8C96A3]">Mira la demo con datos de ejemplo y decide después.</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/demo" className={PRI}>Probar la demo sin cuenta</Link>
              <Link href={SIGNUP} className={SEC}>Crear cuenta</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 border-t border-[#232B36] px-5 pb-10 pt-6 text-sm text-[#8C96A3]">
        <span className="flex items-center gap-2"><GarraMark className="size-6" />Garra · migarra.app</span>
        <nav className="flex gap-5" aria-label="Legal">
          <Link href="/privacidad" className="hover:text-[#EEF1F4]">Privacidad</Link>
          <Link href="/terminos" className="hover:text-[#EEF1F4]">Condiciones de uso</Link>
          <Link href="/login" className="hover:text-[#EEF1F4]">Entrar</Link>
        </nav>
      </footer>
    </div>
  )
}
