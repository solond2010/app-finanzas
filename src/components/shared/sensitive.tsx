"use client"

import { type ReactNode } from "react"
import { usePrivacy } from "@/lib/privacy"
import { cn } from "@/lib/utils"

export function Sensitive({ children, className, as: Tag = "span" }: { children: ReactNode; className?: string; as?: "span" | "p" | "div" | "strong" }) {
  const { privacy } = usePrivacy()
  return (
    <Tag className={cn(privacy && "blur-[8px] select-none", className)} aria-hidden={privacy || undefined}>
      {children}
    </Tag>
  )
}
