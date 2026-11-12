"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "@/components/icons"

const DIALOG_MAX_TOKENS: Record<string, string> = {
  "sm:max-w-sm": "24rem",
  "max-w-sm": "24rem",
  "sm:max-w-md": "28rem",
  "max-w-md": "28rem",
  "sm:max-w-lg": "32rem",
  "max-w-lg": "32rem",
  "sm:max-w-xl": "36rem",
  "max-w-xl": "36rem",
  "sm:max-w-2xl": "42rem",
  "max-w-2xl": "42rem",
  "sm:max-w-3xl": "48rem",
  "max-w-3xl": "48rem",
}

function dialogMaxFromClass(className?: string): string | undefined {
  if (!className) return undefined
  let found: string | undefined
  for (const [token, value] of Object.entries(DIALOG_MAX_TOKENS)) {
    if (className.includes(token)) found = value
  }
  return found
}

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}


function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}


function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
      <DialogPrimitive.Backdrop
        data-slot="dialog-overlay"
        className={cn(
        "fixed inset-0 isolate z-[55] bg-black/40 dark:bg-black/60 duration-200 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          className
        )}
        {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  style,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  const dialogMax = typeof className === "string" ? dialogMaxFromClass(className) : undefined
  return (
    <DialogPortal>
      <DialogOverlay />
        <DialogPrimitive.Popup
        data-slot="dialog-content"
        style={{ ["--dialog-max" as string]: dialogMax ?? "24rem", ...style }}
        className={cn(
          "fixed top-1/2 left-1/2 z-[56] grid max-h-[calc(100svh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full min-w-0 max-w-[min(var(--dialog-max,24rem),calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl bg-popover p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-sm text-popover-foreground shadow-2xl duration-200 outline-none max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:w-full max-sm:max-w-[100vw] max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[28px] max-sm:border-b-0 max-sm:data-open:zoom-in-100 max-sm:data-open:slide-in-from-bottom max-sm:data-closed:zoom-out-100 max-sm:data-closed:slide-out-to-bottom max-sm:duration-300 sm:max-h-[85svh] sm:max-w-[min(var(--dialog-max,24rem),calc(100vw-2rem))] dark:shadow-2xl dark:shadow-black/60 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
          // Tras el className del caller: un max-w-md no puede tumbar el tope del viewport.
          "max-sm:!max-w-[100vw] sm:!max-w-[min(var(--dialog-max,24rem),calc(100vw-2rem))]",
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
                aria-label="Cerrar"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Cerrar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex min-w-0 flex-col-reverse flex-wrap gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-semibold",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
}
