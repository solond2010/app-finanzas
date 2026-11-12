"use client"

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronLeft, ChevronRight, X } from "@/components/icons"
import { cn } from "@/lib/utils"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"

// Selector de periodo compartido: en escritorio, popover flotante anclado
// bajo la píldora del periodo (sombra, radio y superficie de la app; se
// cierra al elegir, al pulsar fuera o con Esc). En móvil (<640 px), hoja
// inferior como el menú «Más» (fondo atenuado y zona segura).

const MOBILE_QUERY = "(max-width: 639px)"

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

export function useIsMobileSheet() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => false)
}

export function PeriodPopover({
  open,
  onOpenChange,
  title,
  trigger,
  children,
  align = "end",
  className,
  panelClassName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  trigger: ReactNode
  children: ReactNode
  align?: "start" | "center" | "end"
  className?: string
  panelClassName?: string
}) {
  const mobile = useIsMobileSheet()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        onOpenChange(false)
        wrapperRef.current?.querySelector<HTMLElement>("[data-period-trigger]")?.focus()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (wrapperRef.current?.contains(target) || panelRef.current?.contains(target)) return
      onOpenChange(false)
    }
    window.addEventListener("keydown", onKeyDown)
    if (!mobile) document.addEventListener("pointerdown", onPointerDown)
    // Foco en la opción marcada (o la primera) para poder seguir con teclado.
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current
      const target = panel?.querySelector<HTMLElement>("[aria-checked=true]") ?? panel?.querySelector<HTMLElement>("button:not([disabled])")
      target?.focus({ preventScroll: true })
    })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [open, mobile, onOpenChange])

  useBodyScrollLock(open && mobile, "[data-period-sheet]")

  const header = (
    <div className="mb-2 flex items-center justify-between gap-2 px-1">
      <p id={titleId} className={cn("font-semibold text-foreground", mobile ? "text-lg" : "text-xs uppercase tracking-wide text-muted-foreground")}>{title}</p>
      {mobile && (
        <button type="button" onClick={() => onOpenChange(false)} aria-label="Cerrar" className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95">
          <X className="size-4" />
        </button>
      )}
    </div>
  )

  return (
    <div ref={wrapperRef} className={cn("relative", open && !mobile && "z-40", className)}>
      {trigger}
      {open && !mobile && (
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby={titleId}
          className={cn(
            "absolute top-full z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-150",
            align === "end" ? "right-0 origin-top-right" : align === "start" ? "left-0 origin-top-left" : "left-1/2 -translate-x-1/2 origin-top",
            panelClassName,
          )}
        >
          <div className="max-h-[min(70svh,34rem)] overflow-y-auto overscroll-contain p-1">
            {header}
            {children}
          </div>
        </div>
      )}
      {open && mobile && typeof document !== "undefined" && createPortal(
        <>
          <button type="button" aria-label="Cerrar" className="fixed inset-0 z-[59] bg-black/50 backdrop-blur-[2px] animate-in fade-in-0 duration-200" onClick={() => onOpenChange(false)} />
          <section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-period-sheet className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[calc(100svh-env(safe-area-inset-top)-1rem)] max-w-lg overflow-y-auto overscroll-contain rounded-t-[28px] border border-b-0 border-border bg-card px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl animate-in slide-in-from-bottom duration-300 ease-out"
          >
            <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
            {header}
            {children}
          </section>
        </>,
        document.body,
      )}
    </div>
  )
}

/** Fila de opción: lista vertical compacta con la opción vigente marcada. */
export function PeriodOption({ selected, onSelect, children, hint }: { selected: boolean; onSelect: () => void; children: ReactNode; hint?: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-10",
        selected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-xs font-normal text-muted-foreground">{hint}</span>}
      <Check className={cn("size-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
    </button>
  )
}

export function PeriodDivider() {
  return <div role="separator" className="my-1.5 h-px bg-border" />
}

const MONTHS_SHORT = Array.from({ length: 12 }, (_, month) => new Date(2026, month, 1).toLocaleDateString("es-ES", { month: "short" }).replace(".", ""))

export function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** Rejilla de meses con cambio de año (no deja elegir meses futuros). */
export function MonthGrid({ year, onYearChange, selected, onSelect, max }: { year: number; onYearChange: (year: number) => void; selected: string | null; onSelect: (month: string) => void; max: string }) {
  const maxYear = Number(max.slice(0, 4))
  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <button type="button" onClick={() => onYearChange(year - 1)} aria-label="Año anterior" className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft className="size-4" /></button>
        <span className="text-sm font-semibold tabular-nums">{year}</span>
        <button type="button" onClick={() => onYearChange(Math.min(maxYear, year + 1))} disabled={year >= maxYear} aria-label="Año siguiente" className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35"><ChevronRight className="size-4" /></button>
      </div>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {MONTHS_SHORT.map((label, index) => {
          const month = `${year}-${String(index + 1).padStart(2, "0")}`
          const isSelected = month === selected
          const future = month > max
          return (
            <button
              key={month}
              type="button"
              disabled={future}
              onClick={() => onSelect(month)}
              aria-pressed={isSelected}
              className={cn(
                "min-h-10 rounded-xl text-sm font-medium capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted/40 text-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
