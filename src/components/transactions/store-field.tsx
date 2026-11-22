"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  MAX_STORE_NAME,
  SUPERMARKET_OTHER_STORE,
  SUPERMARKET_STORES,
  normalizeStoreName,
  sameStoreName,
} from "@/lib/supermarket"

export function StoreField({
  value,
  onChange,
  remembered,
  id = "transaction-store",
  labelClassName,
}: {
  value: string
  onChange: (value: string) => void
  remembered: string[]
  id?: string
  labelClassName?: string
}) {
  const current = normalizeStoreName(value)
  const chips = useMemo(() => [...SUPERMARKET_STORES, ...remembered], [remembered])
  const matchesChip = chips.some((name) => sameStoreName(name, current))
  const [otherOpen, setOtherOpen] = useState(Boolean(current && !matchesChip))
  const showOther = otherOpen || Boolean(current && !matchesChip)

  const selectStore = (name: string) => {
    setOtherOpen(false)
    onChange(sameStoreName(current, name) ? "" : name)
  }

  const openOther = () => {
    setOtherOpen(true)
    if (matchesChip) onChange("")
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={showOther ? id : undefined} className={cn("text-sm font-medium text-foreground", labelClassName)}>
        Tienda <span className="font-normal text-muted-foreground">Opcional</span>
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tienda">
        {chips.map((name) => {
          const selected = !showOther && sameStoreName(name, current)
          return (
            <button
              key={name}
              type="button"
              onClick={() => selectStore(name)}
              aria-pressed={selected}
              className={cn(
                "inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-xs font-medium leading-none transition-colors",
                selected
                  ? "border-primary/45 bg-primary/10 text-primary"
                  : "border-border bg-background/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {name}
            </button>
          )
        })}
        <button
          type="button"
          onClick={openOther}
          aria-pressed={showOther}
          className={cn(
            "inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-xs font-medium leading-none transition-colors",
            showOther
              ? "border-primary/45 bg-primary/10 text-primary"
              : "border-border bg-background/50 text-muted-foreground hover:text-foreground",
          )}
        >
          {SUPERMARKET_OTHER_STORE}
        </button>
      </div>
      {showOther && (
        <>
          <Input
            id={id}
            value={current}
            onChange={(event) => onChange(normalizeStoreName(event.target.value))}
            placeholder="Nombre de la tienda"
            maxLength={MAX_STORE_NAME}
            autoComplete="off"
            className="mt-1 h-12 text-base"
          />
          <p className="text-xs text-muted-foreground">Se recordará para la próxima vez.</p>
        </>
      )}
    </div>
  )
}
