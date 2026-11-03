"use client"

import type { ReactNode } from "react"
import { Popover } from "@base-ui/react/popover"
import { Info } from "@/components/icons"
import { cn } from "@/lib/utils"

/** Botón «i» que abre una explicación. Funciona con clic y con toque (móvil). */
export function InfoPopover({ label, title, children, className }: { label: string; title?: string; children: ReactNode; className?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", className)}
      >
        <Info className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} collisionPadding={12} className="z-[70]">
          <Popover.Popup className="w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-popover p-4 text-sm text-popover-foreground shadow-2xl shadow-black/40 outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity">
            {title && <Popover.Title className="mb-2 text-sm font-semibold text-foreground">{title}</Popover.Title>}
            <div className="space-y-2 text-[13px] leading-5 text-muted-foreground">{children}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
