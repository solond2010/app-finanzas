"use client"

import { createElement, useState } from "react"
import { Input } from "@/components/ui/input"
import { Search } from "@/components/icons"
import { autoCategoryIconFor, searchCategoryIcons } from "@/components/icons/category-icon"
import { cn } from "@/lib/utils"

/**
 * Rejilla con buscador para elegir el icono de una categoría. `null` =
 * automático (el icono que la app deduce del nombre, como hasta ahora).
 */
export function CategoryIconPicker({
  value,
  onChange,
  name,
  className,
}: {
  value: string | null
  onChange: (icon: string | null) => void
  /** Nombre de la categoría, para enseñar el icono automático. */
  name: string
  className?: string
}) {
  const [query, setQuery] = useState("")
  const results = searchCategoryIcons(query)
  const tile = "flex aspect-square min-h-10 w-full items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  const on = "border-primary/60 bg-primary/12 text-primary"
  const off = "border-border/60 bg-background/40 text-foreground hover:bg-muted/70"
  const iconProps = { weight: "duotone" as const, size: 20, "aria-hidden": true, className: "app-icon app-icon-cat", style: { "--cat-color": "var(--icon-accent)" } as React.CSSProperties }

  return (
    <div className={cn("space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-2.5", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar icono: comida, coche, mascota…" aria-label="Buscar icono" className="h-9 pl-8 text-base sm:text-sm" />
      </div>
      <div role="radiogroup" aria-label="Icono de la categoría" className="grid max-h-52 grid-cols-6 gap-1.5 overflow-y-auto overscroll-contain p-0.5 sm:grid-cols-8">
        {!query && (
          <button type="button" role="radio" aria-checked={value === null} title="Automático (según el nombre)" aria-label="Automático (según el nombre)" onClick={() => onChange(null)} className={cn(tile, "relative", value === null ? on : off)}>
            {createElement(autoCategoryIconFor(name), iconProps)}
            <span className="absolute bottom-0.5 right-1 text-[8px] font-bold uppercase text-muted-foreground">auto</span>
          </button>
        )}
        {results.map((c) => (
          <button key={c.key} type="button" role="radio" aria-checked={value === c.key} title={c.label} aria-label={c.label} onClick={() => onChange(c.key)} className={cn(tile, value === c.key ? on : off)}>
            {createElement(c.icon, iconProps)}
          </button>
        ))}
      </div>
      {results.length === 0 && <p className="px-1 pb-1 text-xs text-muted-foreground">Ningún icono coincide. Prueba con otra palabra.</p>}
    </div>
  )
}
