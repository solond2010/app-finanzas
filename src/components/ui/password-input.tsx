"use client"

import { useState, type ComponentProps } from "react"
import { Eye, EyeOff } from "@/components/icons"
import { cn } from "@/lib/utils"

/** Campo de contraseña con botón para mostrarla u ocultarla (zona táctil de 44 px). */
export function PasswordInput({ className, wrapperClassName, ...props }: Omit<ComponentProps<"input">, "type"> & { wrapperClassName?: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <input {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {visible ? <EyeOff weight="duotone" className="size-5" /> : <Eye weight="duotone" className="size-5" />}
      </button>
    </div>
  )
}
