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

/** Ancho máximo declarado en el className de un diálogo, para toparlo con el viewport. */
export function dialogMaxFromClass(className?: string): string | undefined {
  if (!className) return undefined
  const cssVar = className.match(/\[--dialog-max:([^\]]+)\]/)
  if (cssVar) return cssVar[1].trim()
  let found: string | undefined
  for (const [token, value] of Object.entries(DIALOG_MAX_TOKENS)) {
    if (className.includes(token)) found = value
  }
  const withMin = [...className.matchAll(/(?:sm:|md:|lg:)?(?:max-w|w)-\[min\(([^,]+),/g)]
  if (withMin.length) found = withMin[withMin.length - 1][1].trim()
  const simple = [...className.matchAll(/(?:sm:|md:|lg:)?(?:max-w|w)-\[(\d+(?:px|rem|vw|dvw|svw))\]/g)]
  if (simple.length) found = simple[simple.length - 1][1]
  return found
}
