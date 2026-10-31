// Asa visual de las hojas inferiores: en móvil los Dialog se anclan abajo
// (ver ui/dialog.tsx) y esta barrita indica que es una hoja, no una página.
export function SheetHandle() {
  return <div aria-hidden="true" className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-muted-foreground/30 sm:hidden" />
}

// El aspecto de hoja (esquinas de 28 px, anclada abajo, entrada desde abajo)
// ya lo pone ui/dialog.tsx en móvil; aquí solo se deja sitio al asa.
export const SHEET_CONTENT = "max-sm:pt-3"
