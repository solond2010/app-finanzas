// Asa visual de las hojas inferiores: en móvil los Dialog se anclan abajo
// (ver ui/dialog.tsx) y esta barrita indica que es una hoja, no una página.
export function SheetHandle() {
  return <div aria-hidden="true" className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-muted-foreground/30 sm:hidden" />
}

// Clases para DialogContent con el mismo aspecto de hoja que el menú «Más»
// móvil: esquinas de 28 px, borde sin línea inferior y entrada desde abajo.
export const SHEET_CONTENT = "max-sm:rounded-t-[28px] max-sm:border max-sm:border-b-0 max-sm:border-border max-sm:pt-3 max-sm:data-open:zoom-in-100 max-sm:data-open:slide-in-from-bottom-4"
