"use client"

import { useAnimatedNumber } from "@/lib/hooks/use-animated-number"

export function AnimatedNumber({ value, prefix = "", suffix = "€" }: { value: number; prefix?: string; suffix?: string }) {
  const animated = useAnimatedNumber(Math.round(value))
  return <>{prefix}{animated.toLocaleString("es-ES")}{suffix}</>
}
