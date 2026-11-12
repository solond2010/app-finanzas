import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const root = resolve(__dirname, "../..")
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8")

/** Archivos del shell: si alguien vuelve a atar la altura a 100vh/100dvh, el Inicio tiembla en Chrome Android. */
export const SHELL_FILES = [
  "src/app/layout.tsx",
  "src/app/(main)/layout.tsx",
  "src/app/(main)/main-shell.tsx",
  "src/app/globals.css",
] as const

const WHY =
  "En Chrome Android, 100vh / 100dvh / min-h-screen cambian al ocultar la barra de direcciones y el layout tiembla. El shell debe usar 100svh (min-h-svh) y overflow-x-clip. overflow-x-hidden fuerza overflow-y:auto y puede crear un scroll interno que lucha con el del documento. No asignes height con visualViewport ni window.innerHeight."

function stripComments(source: string, css: boolean) {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, "")
  if (!css) out = out.replace(/(^|[^:'"])\/\/.*$/gm, "$1")
  return out
}

/** Permite `min-height: 100vh` solo si la siguiente declaración es `min-height: 100svh`. */
function isVhFallback(code: string, index: number) {
  return /^\s*;?\s*(?:min-)?height:\s*100svh/.test(code.slice(index + "100vh".length))
}

export function shellHeightViolations(rel: string, source: string): string[] {
  const css = rel.endsWith(".css")
  const code = stripComments(source, css)
  const found: string[] = []
  const patterns: Array<[RegExp, string]> = [
    [/\bmin-h-screen\b/, "min-h-screen (equivale a 100vh)"],
    [/(?<![\w-])h-screen\b/, "h-screen (equivale a 100vh)"],
    [/\bmin-h-dvh\b/, "min-h-dvh (100dvh, altura dinámica)"],
    [/(?<![\w-])h-dvh\b/, "h-dvh (100dvh, altura dinámica)"],
    [/\boverflow-x-hidden\b/, "overflow-x-hidden (fuerza overflow-y:auto)"],
    [/\bvisualViewport\b/, "visualViewport"],
    [/\binnerHeight\b/, "window.innerHeight"],
  ]
  for (const [re, label] of patterns) {
    if (re.test(code)) found.push(`${rel}: no uses ${label}. ${WHY}`)
  }
  if (/100dvh/.test(code)) found.push(`${rel}: no uses 100dvh. ${WHY}`)
  for (const match of code.matchAll(/100vh/g)) {
    if (!isVhFallback(code, match.index ?? -1)) {
      found.push(`${rel}: no uses 100vh (salvo fallback seguido de 100svh). ${WHY}`)
    }
  }
  return found
}

describe("altura estable del shell (Android Chrome)", () => {
  it("falla si el shell vuelve a usar min-h-screen, 100vh/100dvh u overflow-x-hidden", () => {
    const all: string[] = []
    for (const rel of SHELL_FILES) {
      all.push(...shellHeightViolations(rel, read(rel)))
    }
    expect(all, all.join("\n")).toEqual([])
  })

  it("el shell y el body usan 100svh y overflow-x-clip, con scroll suave desactivado en táctil", () => {
    const shell = read("src/app/(main)/main-shell.tsx")
    const layout = read("src/app/layout.tsx")
    const css = read("src/app/globals.css")

    expect(shell, "main-shell debe usar min-h-svh").toMatch(/min-h-svh/)
    expect(shell, "main-shell debe usar overflow-x-clip").toMatch(/overflow-x-clip/)
    expect(layout, "el body del layout raíz debe usar min-h-svh").toMatch(/<body[^>]*min-h-svh/)
    expect(css, "globals.css debe fijar min-height: 100svh").toMatch(/min-height:\s*100svh/)
    expect(
      css,
      "globals.css debe poner scroll-behavior: auto en puntero grosero, si no el scroll suave pelea con la barra de Chrome",
    ).toMatch(/pointer:\s*coarse[\s\S]*scroll-behavior:\s*auto/)
  })
})
