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

const BUTTON_CLASS = "h-auto min-h-11 w-full shrink-0 justify-center whitespace-nowrap px-3 text-[clamp(0.75rem,2.8vw,0.875rem)] font-semibold sm:px-4"

function PaywallGhostPreview() {
  return (
    <div className="flex min-h-[22rem] flex-col gap-4 p-4 sm:min-h-[26rem] sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
          <div className="h-3 w-24 rounded-full bg-muted" />
          <div className="mt-3 h-9 w-40 rounded-lg bg-muted" />
          <div className="mt-6 h-24 rounded-xl bg-gradient-to-r from-muted via-muted/50 to-muted" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
          <div className="h-3 w-20 rounded-full bg-muted" />
          <div className="mt-4 space-y-2.5">
            <div className="h-2.5 w-full rounded-full bg-muted" />
            <div className="h-2.5 w-5/6 rounded-full bg-muted" />
            <div className="h-2.5 w-2/3 rounded-full bg-muted" />
          </div>
        </div>
      </div>
      <div className="min-h-[8rem] flex-1 rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
        <div className="h-3 w-32 rounded-full bg-muted" />
        <div className="mt-4 h-20 rounded-xl bg-gradient-to-t from-muted to-muted/30" />
      </div>
    </div>
  )
}

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
    <div
      data-paywall-notice
      className={cn(
        "mx-auto w-full min-w-0 max-w-[min(32rem,calc(100vw-2rem))] overflow-x-hidden rounded-2xl border border-[color-mix(in_oklch,var(--gold),transparent_65%)] bg-card/95 p-4 text-center shadow-[0_12px_40px_-18px_rgba(0,0,0,0.55)] sm:p-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-center gap-2 text-[var(--gold)]">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10">
          <Lock className="size-5" />
        </span>
        <p className="min-w-0 text-pretty break-words text-left font-heading text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</p>
      </div>
      <p className="mt-2 text-pretty break-words text-sm leading-5 text-muted-foreground">{description}</p>
      <div className="mt-4 flex min-w-0 flex-col gap-2">
        <Button className={BUTTON_CLASS} disabled={!!busy} onClick={() => buy("pro_monthly")}>
          <Crown className="size-4 shrink-0" />
          {busy === "pro_monthly" ? "Abriendo…" : "Pásate a Pro · 1,99 €/mes"}
        </Button>
        <Button variant="outline" className={BUTTON_CLASS} disabled={!!busy} onClick={() => buy("pro_lifetime")}>
          {busy === "pro_lifetime" ? "Abriendo…" : "O 14,99 € de por vida"}
        </Button>
      </div>
      <p className="mt-3 text-pretty break-words text-center text-[11px] text-muted-foreground">Tus datos no se borran; solo se desbloquean con Pro.</p>
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
    <div className={cn("relative min-h-[22rem] overflow-hidden rounded-2xl sm:min-h-[26rem]", className)}>
      <div className="pointer-events-none absolute inset-0 select-none blur-[8px] opacity-50" aria-hidden>
        <PaywallGhostPreview />
      </div>
      <div className="pointer-events-none relative select-none blur-[7px] opacity-60 sm:blur-[8px]" aria-hidden>
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
        className="w-[min(32rem,calc(100vw-2rem))] max-w-[min(32rem,calc(100vw-2rem))] min-w-0 overflow-x-hidden border-0 bg-transparent p-0 shadow-none [--dialog-max:32rem]"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <PaywallNotice title={title} description={description} />
      </DialogContent>
    </Dialog>
  )
}
