import { Eye } from "@/components/icons"
import { cn } from "@/lib/utils"

/** «Ver demo» en la pantalla de entrada: navegación completa a /demo. */
export function DemoEntryButton({ className, label = "Ver demo" }: { className?: string; label?: string }) {
  return (
    <a
      href="/demo"
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[color-mix(in_oklch,var(--gold),transparent_45%)] bg-[color-mix(in_oklch,var(--gold),transparent_90%)] px-4 text-sm font-semibold text-foreground transition-all hover:bg-[color-mix(in_oklch,var(--gold),transparent_82%)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <Eye weight="duotone" className="size-[18px] text-[var(--gold)]" />
      {label}
    </a>
  )
}
