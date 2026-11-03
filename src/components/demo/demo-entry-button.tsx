import { ArrowRight, Eye } from "@/components/icons"
import { cn } from "@/lib/utils"

/** «Ver demo» en la pantalla de entrada: botón grande y bien visible
 * (navegación completa a /demo). */
export function DemoEntryButton({ className, label = "Ver la demo", hint = "Datos ficticios · sin registrarte" }: { className?: string; label?: string; hint?: string }) {
  return (
    <a
      href="/demo"
      className={cn(
        "group flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-[var(--gold)] bg-[color-mix(in_oklch,var(--gold),transparent_84%)] px-4 py-2.5 text-left text-foreground shadow-[0_10px_30px_-18px_var(--gold)] transition-all hover:bg-[color-mix(in_oklch,var(--gold),transparent_76%)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--gold),transparent_78%)]">
        <Eye weight="duotone" className="size-[22px] text-[var(--gold)]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-tight">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-tight text-muted-foreground">{hint}</span>}
      </span>
      <ArrowRight className="size-5 shrink-0 text-[var(--gold)] transition-transform group-hover:translate-x-0.5" />
    </a>
  )
}
