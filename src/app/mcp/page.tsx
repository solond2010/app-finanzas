import type { Metadata } from "next"
import Link from "next/link"
import { GarraMark } from "@/components/brand/garra-logo"
import { MCP_ENDPOINT_URL, MCP_OAUTH_CONNECTOR_STEPS } from "@/lib/mcp/public"

const TITLE = "MCP · Garra"
const DESCRIPTION = "Conecta Garra con ChatGPT o Claude para apuntar gastos desde un chat. Está en Pro; si ya lo usabas en el plan gratis, lo conservas."

export const metadata: Metadata = {
  title: "MCP",
  description: DESCRIPTION,
  alternates: { canonical: "https://www.migarra.app/mcp" },
  openGraph: {
    type: "website",
    url: "https://www.migarra.app/mcp",
    siteName: "Garra",
    title: TITLE,
    description: DESCRIPTION,
    locale: "es_ES",
    images: [{ url: "https://www.migarra.app/opengraph-image.png" }],
  },
}

const BTN = "inline-flex min-h-12 items-center justify-center rounded-full px-5 text-[15px] font-bold transition-[filter,transform] active:scale-[0.98]"
const GOLD = BTN + " bg-[#F5A524] text-[#0B0F14] hover:brightness-110"
const GHOST = BTN + " border border-[#232B36] text-[#EEF1F4] hover:bg-white/[0.06]"
const CARD = "rounded-[18px] border border-[#232B36] bg-[#151B23] p-6"

export default function McpPublicPage() {
  return (
    <div className="min-h-svh overflow-x-clip bg-[#0B0F14] text-[#EEF1F4] [color-scheme:dark]">
      <div className="mx-auto max-w-[820px] px-5">
        <nav className="flex items-center justify-between gap-3 py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-lg font-extrabold sm:text-xl">
            <GarraMark className="size-7 shrink-0 sm:size-8" />Garra
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/precios" className="inline-flex min-h-10 items-center px-2 text-sm font-semibold text-[#C3CAD3] hover:text-[#F5A524]">Precios</Link>
            <Link href="/login" className={GHOST + " !min-h-10 px-4 text-sm"}>Entrar</Link>
          </div>
        </nav>

        <header className="pb-8 pt-10">
          <p className="inline-flex rounded-full border border-[#F5A52440] bg-[#F5A5241a] px-3 py-1 text-[13px] font-bold text-[#F5A524]">Solo en Pro</p>
          <h1 className="mt-4 font-heading text-[2rem] font-extrabold leading-[1.05] tracking-tight sm:text-[3rem]">MCP de Garra</h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-7 text-[#C3CAD3]">{DESCRIPTION}</p>
        </header>

        <section className={CARD}>
          <h2 className="text-lg font-bold">Qué es</h2>
          <p className="mt-2 text-[15px] leading-7 text-[#8C96A3]">
            El MCP (Model Context Protocol) permite que un chat, como ChatGPT o Claude, consulte tus cuentas y apunte gastos o ingresos en Garra. Tú autorizas la conexión y puedes revocarla cuando quieras desde Ajustes.
          </p>
        </section>

        <section className={CARD + " mt-4"}>
          <h2 className="text-lg font-bold">Es una función de Pro</h2>
          <p className="mt-2 text-[15px] leading-7 text-[#8C96A3]">
            El MCP está incluido en Pro (mensual, de por vida o durante el mes de prueba). Si ya lo tenías conectado o en uso en el plan gratis, lo conservas. Los precios actuales están en la página de precios.
          </p>
          <Link href="/precios" className={GOLD + " mt-5 sm:w-auto"}>Ver planes</Link>
        </section>

        <section className={CARD + " mt-4"}>
          <h2 className="text-lg font-bold">Cómo conectarlo</h2>
          <p className="mt-2 text-[15px] leading-7 text-[#8C96A3]">URL del servidor:</p>
          <code className="mt-2 block break-all rounded-xl bg-[#0B0F14] px-3 py-3 font-mono text-sm text-[#EEF1F4]">{MCP_ENDPOINT_URL}</code>
          <ol className="mt-5 space-y-4">
            {MCP_OAUTH_CONNECTOR_STEPS.map((step) => (
              <li key={step.title}>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-[15px] leading-7 text-[#8C96A3]">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#232B36] py-8 text-sm text-[#8C96A3]">
          <span className="flex items-center gap-2 font-semibold"><GarraMark className="size-6" />Garra · migarra.app</span>
          <nav className="flex flex-wrap items-center gap-5" aria-label="Legal">
            <Link href="/precios" className="hover:text-[#EEF1F4]">Precios</Link>
            <Link href="/privacidad" className="hover:text-[#EEF1F4]">Privacidad</Link>
            <Link href="/terminos" className="hover:text-[#EEF1F4]">Condiciones de uso</Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}
