"use client"

import { useState, type ReactNode } from "react"
import { Crown, Lock } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { startCheckout } from "@/lib/billing/checkout-client"
import type { CheckoutOption } from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

type NoticeProps = {
  title?: string
  description?: string
  className?: string
}

const DEFAULT_TITLE = "Solo en Pro"
const DEFAULT_DESCRIPTION = "Historial de patrimonio, inversiones y analíticas. Tus datos siguen ahí."

export function PaywallNotice({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  className,
}: NoticeProps) {
  const { toast } = useToast()
  const [busy, setBusy] = useState<CheckoutOption | null>(null)

  async function buy(option: CheckoutOption) {
    setBusy(option)
    try {
      const result = await startCheckout(option)
      if (result.url) { window.location.href = result.url; return }
      toast(result.error ?? "No se pudo abrir el pago", "error")
    } catch {
      toast("No se pudo abrir el pago", "error")
    }
    setBusy(null)
  }

  return (
    <div className={cn("w-full max-w-md rounded-2xl border border-[color-mix(in_oklch,var(--gold),transparent_65%)] bg-card/95 p-4 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.55)] sm:p-6", className)}>
      <div className="flex items-center gap-2 text-[var(--gold)]">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10">
          <Lock className="size-5" />
        </span>
        <p className="font-heading text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button className="h-11 w-full font-semibold sm:flex-1" disabled={!!busy} onClick={() => buy("pro_monthly")}>
          <Crown className="size-4" />
          {busy === "pro_monthly" ? "Abriendo…" : "Pásate a Pro · 1,99 €/mes"}
        </Button>
        <Button variant="outline" className="h-11 w-full sm:flex-1" disabled={!!busy} onClick={() => buy("pro_lifetime")}>
          {busy === "pro_lifetime" ? "Abriendo…" : "O 14,99 € de por vida"}
        </Button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">Tus datos no se borran; solo se desbloquean con Pro.</p>
    </div>
  )
}

type PreviewProps = NoticeProps & {
  locked: boolean
  children: ReactNode
}

export function PaywallPreview({
  locked,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  children,
  className,
}: PreviewProps) {
  if (!locked) return <>{children}</>

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div className="pointer-events-none select-none blur-[7px] opacity-60 sm:blur-[8px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_oklch,var(--background),transparent_28%)] p-3 sm:p-5">
        <PaywallNotice title={title} description={description} />
      </div>
    </div>
  )
}

/** Aviso bajo demanda: solo se abre cuando el usuario pulsa la función. */
export function PaywallDialog({
  open,
  onOpenChange,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: NoticeProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-md border-0 bg-transparent p-0 shadow-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <PaywallNotice title={title} description={description} />
      </DialogContent>
    </Dialog>
  )
}
