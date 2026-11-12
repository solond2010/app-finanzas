"use client"

import { useEffect } from "react"

let lockCount = 0
let prevHtmlOverflow = ""
let prevBodyOverflow = ""

function lock() {
  if (lockCount === 0) {
    prevHtmlOverflow = document.documentElement.style.overflow
    prevBodyOverflow = document.body.style.overflow
    // Solo overflowY: no tocamos overflowX (clip/hidden en X convierte Y
    // en un scroll container y pelea con el viewport).
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
  }
}

/**
 * Bloquea el scroll del documento mientras un sheet/menú está abierto y lo
 * libera siempre al desmontar. Usa un contador para no dejar el body pillado
 * si se abren dos capas o si una se cierra mal.
 */
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
