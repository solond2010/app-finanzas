import { ArrowRight, Eye } from "@/components/icons"
import { DEMO_EXIT_HREF, DEMO_SIGNUP_HREF } from "@/lib/demo/constants"

/** Aviso de demo arriba, en el flujo de la página (no `fixed`) para no pelear
 * con el scroll de iOS. Enlaces <a> (no <Link>): navegación completa para
 * salir del modo demo de verdad. */
export function DemoBanner() {
  return (
    <div
      role="region"
      aria-label="Modo demo"
      className="sticky top-0 z-[45] border-b border-[color-mix(in_oklch,var(--gold),transparent_72%)] bg-white/95 pt-[env(safe-area-inset-top)] text-foreground shadow-lg shadow-black/5 backdrop-blur dark:bg-[#0B0F14]/95 dark:text-white dark:shadow-black/20"
    >
      <div className="mx-auto flex h-12 w-full max-w-[1840px] items-center gap-2.5 px-3 sm:gap-3 sm:px-6 lg:h-14 lg:px-8 2xl:px-10">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--gold),transparent_86%)] text-[var(--gold)]">
          <Eye weight="duotone" className="size-[18px]" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] leading-tight sm:text-sm">
          <span className="font-semibold">Estás viendo una demo</span>
          <span className="hidden text-muted-foreground md:inline dark:text-white/60"> · Datos ficticios: toca lo que quieras, nada se guarda</span>
        </p>
        <a
          href={DEMO_EXIT_HREF}
          className="hidden h-9 shrink-0 items-center rounded-full px-3 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] sm:inline-flex"
        >
          Salir
        </a>
        <a
          href={DEMO_SIGNUP_HREF}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--gold)] px-3.5 text-[13px] font-semibold text-[#0B0F14] shadow-md shadow-[color-mix(in_oklch,var(--gold),transparent_70%)] transition-[filter,transform] hover:brightness-110 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground dark:focus-visible:ring-white sm:text-sm"
        >
          Crear mi cuenta
          <ArrowRight weight="bold" className="size-3.5" />
        </a>
      </div>
    </div>
  )
}
