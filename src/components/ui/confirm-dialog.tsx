"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { type ReactNode } from "react"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description: ReactNode
  confirmLabel?: string
  destructive?: boolean
}

export function ConfirmDialog({ open, onOpenChange, onConfirm, title, description, confirmLabel = "Confirmar", destructive }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
          {destructive && (
            <div className="rounded-full bg-red-500/10 p-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          )}
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={() => { onConfirm(); onOpenChange(false) }}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
