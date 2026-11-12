import Link from "next/link"
import type { ReactNode } from "react"

export const LEGAL_UPDATED = "3 de noviembre de 2026"

/** Página legal sencilla: se lee igual con o sin sesión y en la demo. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:py-14">
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">← Volver a Garra</Link>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: {LEGAL_UPDATED}</p>
        <p className="mt-5 text-base leading-7 text-muted-foreground">{intro}</p>
        <div className="mt-8 space-y-7 text-[15px] leading-7 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground">
          {children}
        </div>
        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
          <Link href="/privacidad" className="hover:text-foreground hover:underline">Política de privacidad</Link>
          <Link href="/terminos" className="hover:text-foreground hover:underline">Condiciones de uso</Link>
        </nav>
      </article>
    </main>
  )
}
