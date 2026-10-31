import { cn } from "@/lib/utils"

/**
 * Marca de Garra: tres trazos ascendentes sobre un cuadrado naranja.
 * Dibujada en una rejilla de 32 px para que se vea nítida desde 16 px.
 * Mismo dibujo que src/app/icon.svg (favicon) y los iconos de la PWA.
 */
export function GarraMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-9 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="7.5" fill="#F5A524" />
      <g fill="#0B0F14">
        <polygon points="8,25 12,25 15.5,12 13.5,11" />
        <polygon points="14,25 18,25 22,8.5 20,7.5" />
        <polygon points="20,25 24,25 26.5,14.5 24.5,13.5" fillOpacity={0.55} />
      </g>
    </svg>
  )
}

/** Logo completo: marca + nombre «Garra» y, opcionalmente, el lema. */
export function GarraLogo({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <GarraMark />
      <div className="min-w-0">
        <p className="font-heading text-lg font-bold leading-none tracking-tight text-foreground">Garra</p>
        {tagline && <p className="mt-1 text-[11px] font-medium text-muted-foreground">Tus finanzas, con garra</p>}
      </div>
    </div>
  )
}
