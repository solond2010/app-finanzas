"use client"

import { useMemo, useState } from "react"
import { Share } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { buildPreciseNetWorthHistoryMonthly, getCurrencyByAccount } from "@/lib/calculations"
import { assetDebtNetAt } from "@/lib/assets-debts"
import {
  SHARE_MONTH_FOOTER,
  buildShareMonth,
  shareMonthFileName,
  shareMonthView,
} from "@/lib/billing/share-month"
import { createShareMonthCanvas, shareMonthBlob, type ShareMonthFonts } from "@/lib/billing/share-month-draw"
import { localDateKey } from "@/lib/date-utils"
import { useAssetsDebts } from "@/lib/use-assets-debts"
import { useMe } from "@/lib/use-me"
import { useFinance } from "@/lib/store"
import { cn } from "@/lib/utils"

function canvasFonts(): ShareMonthFonts {
  const styles = getComputedStyle(document.documentElement)
  const heading = styles.getPropertyValue("--font-display").trim() || '"Bricolage Grotesque"'
  const sans = styles.getPropertyValue("--font-sans").trim() || "Inter"
  return {
    heading: `${heading}, "Bricolage Grotesque", Inter, sans-serif`,
    sans: `${sans}, Inter, sans-serif`,
  }
}

async function shareOrDownloadPng(blob: Blob, fileName: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], fileName, { type: "image/png" })
  const payload = { files: [file], title, text: SHARE_MONTH_FOOTER }
  try {
    if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share(payload)
      return "shared"
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled"
    if (error instanceof Error && error.name === "AbortError") return "cancelled"
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  return "downloaded"
}

export function ShareMonthButton({
  netWorthNow,
  className,
  compact = false,
}: {
  netWorthNow: number
  className?: string
  compact?: boolean
}) {
  const { toast } = useToast()
  const { state } = useFinance()
  const { me } = useMe()
  const { assets, debts, values } = useAssetsDebts()
  const [busy, setBusy] = useState(false)

  const netWorthByMonth = useMemo(() => {
    const points = buildPreciseNetWorthHistoryMonthly(state.accounts, state.transactions, 8)
    const todayKey = localDateKey()
    const map: Record<string, number> = {}
    for (const point of points) {
      const key = point.date.slice(0, 7)
      map[key] = point.patrimonio + assetDebtNetAt(point.date, assets, values, debts, state.transactions, todayKey)
    }
    return map
  }, [state.accounts, state.transactions, assets, values, debts])

  const card = useMemo(
    () =>
      buildShareMonth({
        transactions: state.transactions,
        currencies: getCurrencyByAccount(state.accounts),
        netWorthNow,
        netWorthByMonth,
        today: localDateKey(),
        name: me?.name ?? null,
        email: me?.email ?? null,
      }),
    [state.transactions, state.accounts, netWorthNow, netWorthByMonth, me?.name, me?.email],
  )

  const share = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (document.fonts?.ready) await document.fonts.ready
      const canvas = createShareMonthCanvas(shareMonthView(card), { fonts: canvasFonts() })
      const blob = await shareMonthBlob(canvas)
      const fileName = shareMonthFileName(card.label)
      const result = await shareOrDownloadPng(blob, fileName, `Mi mes · ${card.label}`)
      if (result === "downloaded") toast("Imagen descargada", "success")
    } catch (error) {
      console.error("[share-month]", error)
      toast("No se pudo compartir el mes. Inténtalo de nuevo.", "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={() => void share()}
      disabled={busy}
      variant="outline"
      className={cn(
        "w-full min-w-0 gap-1.5 whitespace-nowrap rounded-full px-3 text-xs sm:w-auto sm:flex-none sm:px-4 sm:text-sm",
        compact && "h-10 px-3",
        className,
      )}
      title={`Comparte el resumen de ${card.label} como imagen.`}
    >
      <Share className="h-4 w-4" />
      {busy ? "Generando…" : "Compartir mi mes"}
    </Button>
  )
}
