"use client"

import { useState, useEffect, useRef } from "react"

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function useAnimatedNumber(target: number, duration = 600) {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (target === prevRef.current) return

    const from = prevRef.current
    const diff = target - from
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      setDisplay(Math.round(from + diff * easeOutCubic(t)))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    prevRef.current = target

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return display
}
