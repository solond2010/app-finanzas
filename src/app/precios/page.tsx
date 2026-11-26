import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { CaretDown, PlayCircle } from "@phosphor-icons/react/dist/ssr"
import { GarraMark } from "@/components/brand/garra-logo"
import { createSupabaseRouteClient } from "@/lib/server/request-context"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { getUserPlanRow } from "@/lib/server/billing"
import { shouldOfferMonthlyTrial } from "@/lib/billing/monthly-trial"
import {
  pricingCatalog,
  pricingProHref,
  pricingStartHref,
  type PricingFeature,
} from "@/lib/billing/pricing-page"
import { LifetimePromoCta } from "@/components/billing/lifetime-promo-cta"

const TITLE = "Precios · Garra"
const DESCRIPTION = "Empieza gratis. Pasa a Pro cuando quieras cuentas ilimitadas, inversiones, historial y exportación."
const SIGNUP = "/login?modo=registro"

export const metadata: Metadata = {
  title: "Precios",
  description: DESCRIPTION,
  alternates: { canonical: "https://www.migarra.app/precios" },
  openGraph: { type: "website", url: "https://www.migarra.app/precios", siteName: "Garra", title: TITLE, description: DESCRIPTION, locale: "es_ES" },
}

export const dynamic = "force-dynamic"

const BTN = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-[filter,transform] active:scale-[0.98]"
const GOLD = `${BTN} bg-[#F5A524] text-[#0B0F14] hover:brightness-110`
const GHOST = `${BTN} border border-[#232B36] text-[#EEF1F4] hover:bg-white/[0.06]`
const OUTLINE = "inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#232B36] bg-white/[0.03] px-5 text-[15px] font-bold text-[#EEF1F4] transition-[filter,transform] hover:bg-white/[0.07] active:scale-[0.98]"
const GOLD_LG = "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#F5A524] px-5 text-[15px] font-bold text-[#0B0F14] shadow-[0_10px_30px_-10px_#F5A52499] transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"

async function pricingViewer(): Promise<{ signedIn: boolean; offerMonthlyTrial: boolean }> {
  if (!isSupabaseAuthEnabled()) return { signedIn: false, offerMonthlyTrial: true }
  try {
    const supabase = await createSupabaseRouteClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return { signedIn: false, offerMonthlyTrial: true }
    const row = await getUserPlanRow(data.user.id)
    return { signedIn: true, offerMonthlyTrial: shouldOfferMonthlyTrial(row) }
  } catch {
    return { signedIn: false, offerMonthlyTrial: true }
  }
}

export default async function PreciosPage() {
  const { signedIn, offerMonthlyTrial } = await pricingViewer()
  const catalog = pricingCatalog({ offerMonthlyTrial })
  const startHref = pricingStartHref(signedIn)
  const proHref = pricingProHref(signedIn)

  return (
    <div className="min-h-svh overflow-x-clip bg-[#0B0F14] text-[#EEF1F4] [color-scheme:dark]">
      <div className="mx-auto max-w-[1180px] px-5">
        <nav className="flex items-center justify-between gap-3 py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-lg font-extrabold sm:text-xl">
            <GarraMark className="size-7 shrink-0 sm:size-8" />Garra
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href="/login" className={GHOST}>Entrar</Link>
            <Link href={SIGNUP} className={GOLD}>Crear cuenta</Link>
          </div>
        </nav>

        <header className="px-1 pb-2 pt-10 text-center">
          <h1 className="mx-auto max-w-[18ch] font-heading text-[2rem] font-extrabold leading-[1.05] tracking-tight sm:text-[3.25rem]">
            Planes claros, <em className="not-italic text-[#F5A524]">sin letra pequeña</em>.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-6 text-[#C3CAD3]">{DESCRIPTION}</p>
        </header>

        <section className="grid gap-3 py-9 lg:grid-cols-3 lg:gap-3.5" aria-label="Planes">
          <PlanCard
            badge="Para empezar"
            title="Gratis"
            price="0 €"
            unit="para siempre"
            note="Sin tarjeta. Puedes usarla así el tiempo que quieras."
            features={catalog.freeFeatures}
            cta={<Link href={startHref} className={OUTLINE}>Empezar gratis</Link>}
          />
          <PlanCard
            featured
            badge={catalog.monthlyBadge}
            title="Pro mensual"
            price={catalog.monthlyPrice}
            unit="/ mes"
            note={catalog.monthlyNote}
            features={catalog.proFeatures}
            cta={<Link href={proHref} className={GOLD_LG}>Hazte Pro</Link>}
          />
          <PlanCard
            badge="Pago único"
            title="Pro de por vida"
            price={catalog.lifetimeSalePrice ?? catalog.lifetimePrice}
            wasPrice={catalog.lifetimeSalePrice ? catalog.lifetimePrice : undefined}
            unit="pago único"
            offerNote={catalog.lifetimeOffer?.notice}
            note="Pagas una vez. Pro para siempre."
            features={catalog.proFeatures}
            cta={<LifetimePromoCta signedIn={signedIn} href={proHref} className={OUTLINE} />}
          />
        </section>

        <section className="mx-auto max-w-[720px] pb-2 pt-7">
          <h2 className="mb-3.5 text-center font-heading text-[1.35rem] font-extrabold tracking-tight">Preguntas frecuentes</h2>
          {catalog.faq.map((item, index) => (
            <details key={item.q} open={index === 0} className="group mb-2.5 rounded-[14px] border border-[#232B36] bg-[#151B23] px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden">
                {item.q}
                <CaretDown weight="bold" className="size-4 shrink-0 text-[#8C96A3] transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 text-[15px] leading-6 text-[#8C96A3]">
                {item.a}
                {item.q.includes("probarla") && <>{" "}<Link href="/demo" className="font-semibold text-[#F5A524] hover:underline">Probar la demo</Link>.</>}
              </p>
            </details>
          ))}
        </section>

        <section className="my-9 rounded-[24px] border border-[#F5A52433] bg-gradient-to-br from-[#1A1610] to-[#151B23] px-5 py-12 text-center">
          <h2 className="font-heading text-[1.5rem] font-extrabold tracking-tight sm:text-[2.1rem]">Pruébala ahora, sin registrarte</h2>
          <p className="mb-6 mt-2 text-[17px] text-[#8C96A3]">Mira la demo con datos de ejemplo y decide después.</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/demo" className={`${GOLD_LG} sm:w-auto sm:min-w-[220px]`}><PlayCircle weight="duotone" className="size-5" />Probar la demo</Link>
            <Link href={startHref} className={`${OUTLINE} sm:w-auto sm:min-w-[220px]`}>Empezar gratis</Link>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#232B36] pb-10 pt-6 text-sm text-[#8C96A3]">
          <span className="flex items-center gap-2 font-semibold"><GarraMark className="size-6" />Garra · migarra.app</span>
          <nav className="flex flex-wrap items-center gap-5" aria-label="Legal">
            <Link href="/privacidad" className="hover:text-[#EEF1F4]">Privacidad</Link>
            <Link href="/terminos" className="hover:text-[#EEF1F4]">Condiciones de uso</Link>
            <Link href="/login" className="hover:text-[#EEF1F4]">Entrar</Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}

function PlanCard({
  badge,
  title,
  price,
  wasPrice,
  unit,
  offerNote,
  note,
  features,
  cta,
  featured = false,
}: {
  badge: string
  title: string
  price: string
  wasPrice?: string
  unit: string
  offerNote?: string
  note: string
  features: PricingFeature[]
  cta: ReactNode
  featured?: boolean
}) {
  return (
    <article className={featured
      ? "flex flex-col rounded-[14px] border-2 border-[#F5A524] bg-[#151B23] p-5 shadow-[0_0_0_4px_#F5A52422]"
      : "flex flex-col rounded-[14px] border border-[#232B36] bg-[#151B23] p-5"}>
      <p className={featured
        ? "mb-2 inline-flex w-fit rounded-full border border-[#F5A524] bg-[#F5A5241a] px-2 py-0.5 text-[11px] font-semibold text-[#F5A524]"
        : "mb-2 inline-flex w-fit rounded-full border border-[#232B36] px-2 py-0.5 text-[11px] font-semibold text-[#8C96A3]"}>
        {badge}
      </p>
      <h2 className="font-heading text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 font-heading text-3xl font-extrabold tracking-tight text-[#F5A524]">
        {wasPrice && <span className="mr-2 text-lg font-semibold text-[#8C96A3] line-through decoration-[#8C96A3]">{wasPrice}</span>}
        {price}{" "}<span className="text-sm font-medium text-[#8C96A3]">{unit}</span>
      </p>
      {offerNote && <p className="mt-1.5 text-xs font-medium leading-5 text-[#F5A524]">{offerNote}</p>}
      <p className="mt-1.5 text-xs leading-5 text-[#8C96A3]">{note}</p>
      <ul className="mt-4 grid grow gap-2 border-t border-[#232B36] pt-4">
        {features.map((item) => (
          <li key={item.label} className={`flex items-center gap-2 text-sm ${item.included ? "text-[#EEF1F4]" : "text-[#8C96A3]"}`}>
            <span className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${item.included ? "bg-[#0B7D59]/15 text-[#0B7D59]" : "bg-[#C8372A]/15 text-[#C8372A]"}`} aria-hidden>
              {item.included ? "✓" : "×"}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
      <div className="mt-4">{cta}</div>
    </article>
  )
}
