"use client"

import Link from "next/link"
import { CONNECTORS_PRO_HREF, CONNECTORS_PRO_NOTICE } from "@/lib/billing/connectors-access"

/** Aviso suave para el MCP y el Atajo cuando el plan gratis no los conserva. */
export function ProOnlyNotice({ description }: { description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4 text-left">
      <p className="text-sm font-semibold text-foreground">{CONNECTORS_PRO_NOTICE}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      <Link href={CONNECTORS_PRO_HREF} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">
        Ver planes en Precios
      </Link>
    </div>
  )
}
