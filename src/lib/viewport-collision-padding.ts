/** Margen extra, además de la safe area, para que el popup no roce el borde. */
export const VIEWPORT_COLLISION_EXTRA_PX = 8

export type SideInsets = { top: number; right: number; bottom: number; left: number }

function asInset(value: string): number {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** Lee env(safe-area-inset-*) en runtime (Dynamic Island, home indicator, notch). */
export function readSafeAreaInsets(): SideInsets {
  if (typeof document === "undefined") return { top: 0, right: 0, bottom: 0, left: 0 }
  const probe = document.createElement("div")
  probe.style.cssText = "position:fixed;inset:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)"
  document.documentElement.appendChild(probe)
  const cs = getComputedStyle(probe)
  const insets = {
    top: asInset(cs.paddingTop),
    right: asInset(cs.paddingRight),
    bottom: asInset(cs.paddingBottom),
    left: asInset(cs.paddingLeft),
  }
  probe.remove()
  return insets
}

/** Padding que hay que pasar al Positioner para no pintar bajo notch ni home indicator. */
export function viewportCollisionPadding(safe: SideInsets = { top: 0, right: 0, bottom: 0, left: 0 }, extra = VIEWPORT_COLLISION_EXTRA_PX): SideInsets {
  return {
    top: safe.top + extra,
    right: safe.right + extra,
    bottom: safe.bottom + extra,
    left: safe.left + extra,
  }
}
