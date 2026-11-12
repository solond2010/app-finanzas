"use client"

import { useEffect } from "react"

let lockCount = 0
let prevHtmlOverflow = ""
let prevBodyOverflow = ""
let prevScrollX = 0
let prevScrollY = 0

function lock() {
  if (lockCount === 0) {
    prevHtmlOverflow = document.documentElement.style.overflow
    prevBodyOverflow = document.body.style.overflow
    prevScrollX = window.scrollX
    prevScrollY = window.scrollY
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
  }
  lockCount += 1
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.documentElement.style.overflow = prevHtmlOverflow
    document.body.style.overflow = prevBodyOverflow
    // En iOS, quitar overflow:hidden del html/body puede dejar el
    // documento arriba del todo. Restauramos la posición en el mismo
    // turno y en el siguiente frame por si el motor aplica el overflow
    // un tick más tarde.
    const x = prevScrollX
    const y = prevScrollY
    window.scrollTo(x, y)
    requestAnimationFrame(() => window.scrollTo(x, y))
  }
}

/** Bloqueo de scroll del documento con recuento, para hojas propias
 *  (no Base UI). No usa el atajo `body.style.overflow` a ciegas:
 *  libera siempre al desmontar y conserva la posición en iOS. */
export function useBodyScrollLock(active: boolean, sheetSelector?: string) {
  useEffect(() => {
    if (!active) return
    lock()
    const onTouchMove = (event: TouchEvent) => {
      const target = event.target as Element | null
      if (!target) {
        event.preventDefault()
        return
      }
      const sheet = sheetSelector ? target.closest(sheetSelector) : null
      if (sheet && sheet.scrollHeight > sheet.clientHeight + 1) return
      event.preventDefault()
    }
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    return () => {
      document.removeEventListener("touchmove", onTouchMove)
      unlock()
    }
  }, [active, sheetSelector])
}
