"use client"

import { useEffect, useState } from "react"

export function CircularProgress({ value, size = 80, strokeWidth = 6, color = "var(--accent-green)" }: { value: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const targetOffset = circumference - (Math.min(value, 100) / 100) * circumference
  // La animación corre al montar (y si más tarde cambia el valor, solo el
  // trazo). `transition-all` en cada render hacía temblar el anillo de
  // «Tus factores» / puntuación cuando el layout se recalombraba.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const offset = ready ? targetOffset : circumference

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  )
}
