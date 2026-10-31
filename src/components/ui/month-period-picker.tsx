"use client"

import { useState } from "react"
import { CalendarClock, ChevronLeft, ChevronRight } from "@/components/icons"
import { MonthGrid, PeriodDivider, PeriodOption, PeriodPopover, monthKeyOf } from "@/components/ui/period-popover"
import { cn } from "@/lib/utils"

/**
 * Píldora «‹ mes ›» con selector de mes al pulsar la etiqueta (Analíticas,
 * Movimientos). Trabaja con un desplazamiento en meses desde el actual.
 */
export function MonthPeriodPicker({
  monthOffset,
  onMonthOffsetChange,
  label,
  className,
  buttonClassName = "min-h-11 min-w-11",
  labelClassName = "min-w-[9.5rem]",
}: {
  monthOffset: number
  onMonthOffsetChange: (offset: number) => void
  label: string
  className?: string
  buttonClassName?: string
  labelClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const selected = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const [year, setYear] = useState(selected.getFullYear())
  const offsetFor = (month: string) => {
    const [y, m] = month.split("-").map(Number)
    return Math.max(0, (today.getFullYear() - y) * 12 + today.getMonth() + 1 - m)
  }
  const choose = (offset: number) => {
    onMonthOffsetChange(offset)
    setOpen(false)
  }
  const toggle = () => {
    setYear(selected.getFullYear())
    setOpen((value) => !value)
  }

  return (
    <PeriodPopover
      open={open}
      onOpenChange={setOpen}
      title="Elegir mes"
      className={cn("flex items-center gap-1 rounded-full border border-border bg-card p-1", className)}
      trigger={
        <>
          <button onClick={() => onMonthOffsetChange(monthOffset + 1)} className={cn("flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90", buttonClassName)} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" data-period-trigger onClick={toggle} aria-expanded={open} aria-haspopup="dialog" aria-label={`Mes: ${label}. Cambiar`} className={cn("flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted", labelClassName)}>
            <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{label.charAt(0).toUpperCase() + label.slice(1)}</span>
          </button>
          <button onClick={() => onMonthOffsetChange(Math.max(0, monthOffset - 1))} disabled={monthOffset === 0} className={cn("flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 active:scale-90", buttonClassName)} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="space-y-0.5">
        <PeriodOption selected={monthOffset === 0} onSelect={() => choose(0)}>Este mes</PeriodOption>
        <PeriodOption selected={monthOffset === 1} onSelect={() => choose(1)}>Mes anterior</PeriodOption>
      </div>
      <PeriodDivider />
      <MonthGrid year={year} onYearChange={setYear} selected={monthKeyOf(selected)} onSelect={(month) => choose(offsetFor(month))} max={monthKeyOf(today)} />
    </PeriodPopover>
  )
}
