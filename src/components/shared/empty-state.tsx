import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TONE_CLASSES = {
  neutral: "bg-muted/60 text-muted-foreground/60",
  primary: "bg-primary/10 text-primary",
  amber: "bg-amber-500/10 text-amber-500",
} as const

// Estado vacío único para toda la app: icono en círculo tintado + título +
// descripción + acción opcional. `bordered` añade el marco tenue que usan
// los placeholders dentro de una card (gráficos/tablas); sin él, el estado
// vacío ya vive dentro de una card propia (páginas de Cuentas, Inversiones...).
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  bordered = false,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; icon?: LucideIcon; onClick: () => void }
  tone?: keyof typeof TONE_CLASSES
  bordered?: boolean
  className?: string
}) {
  const ActionIcon = action?.icon
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        bordered && "min-h-[220px] rounded-2xl bg-muted/20 ring-1 ring-border/20",
        className
      )}
    >
      <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", TONE_CLASSES[tone])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button size="sm" className="mt-1 gap-1.5" onClick={action.onClick}>
          {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />} {action.label}
        </Button>
      )}
    </div>
  )
}

// Placeholder compacto para huecos de gráfico/lista sin icono ni acción
// (ej. "Sin movimientos en este periodo"), pensado para ocupar el alto fijo
// del elemento que sustituye — pásale la altura vía className.
export function EmptyPlaceholder({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-2xl bg-muted/40 text-center text-sm text-muted-foreground", className)}>
      {text}
    </div>
  )
}
