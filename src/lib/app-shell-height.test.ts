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

describe("un solo scroll de documento en móvil", () => {
  it("body y html no son contenedores de overflow (clip/hidden en X convierte overflow-y en auto)", () => {
    const css = stripComments(read("src/app/globals.css"), true)
    const bodyBlock = css.match(/\bbody\s*\{[^}]*\}/g) ?? []
    const htmlBlock = css.match(/\bhtml\s*\{[^}]*\}/g) ?? []
    for (const block of [...bodyBlock, ...htmlBlock]) {
      expect(block, "no pongas overflow-x: clip/hidden en html o body").not.toMatch(/overflow-x\s*:\s*(clip|hidden)/)
      expect(block, "no pongas overflow: hidden/clip/auto/scroll en html o body").not.toMatch(/overflow\s*:\s*(hidden|clip|auto|scroll)/)
    }
  })

  it("overflow-x-clip está en el wrapper exterior, no en main (si no, nace un scroll interno)", () => {
    const shell = stripComments(read("src/app/(main)/main-shell.tsx"), false)
    expect(shell).toMatch(/flex min-h-svh overflow-x-clip/)
    const mainClass = shell.match(/<main className=\{cn\(([\s\S]*?)\)\}/)
    expect(mainClass, "tiene que haber un <main> con className").toBeTruthy()
    const inner = mainClass![1]
    expect(inner, "main no debe usar overflow-x-clip").not.toMatch(/overflow-x-clip/)
    expect(inner, "main no debe usar min-h-0 (crea un flex child recortado)").not.toMatch(/\bmin-h-0\b/)
  })

  it("el aviso de demo no es fixed ni sticky", () => {
    const banner = stripComments(read("src/components/demo/demo-banner.tsx"), false)
    expect(banner).not.toMatch(/\bfixed\b/)
    expect(banner).not.toMatch(/\bsticky\b/)
  })

  it("el html no fuerza scroll suave de Next (data-scroll-behavior)", () => {
    const layout = stripComments(read("src/app/layout.tsx"), false)
    expect(layout).not.toMatch(/data-scroll-behavior/)
  })

  it("el login no usa overflow-hidden en el cascarón (el teclado virtual tiene que poder hacer scroll)", () => {
    const login = stripComments(read("src/app/login/page.tsx"), false)
    const root = login.match(/className="[^"]*min-h-svh[^"]*"/)
    expect(root, "el login tiene un cascarón min-h-svh").toBeTruthy()
    expect(root![0]).not.toMatch(/overflow-hidden/)
  })

  it("solo el hook de bloqueo pone overflow hidden en body, y las hojas lo usan", () => {
    const hook = read("src/lib/use-body-scroll-lock.ts")
    expect(hook).toMatch(/export function useBodyScrollLock/)
    expect(hook).toMatch(/document\.documentElement\.style\.overflow = "hidden"/)
    expect(hook).toMatch(/document\.body\.style\.overflow = "hidden"/)
    expect(hook, "en iOS hay que restaurar window.scrollTo al liberar").toMatch(/window\.scrollTo/)

    const offenders: string[] = []
    const files = [
      "src/components/ui/period-popover.tsx",
      "src/components/layout/mobile-bottom-nav.tsx",
    ]
    for (const rel of files) {
      const src = read(rel)
      expect(src, `${rel} debe usar useBodyScrollLock`).toMatch(/useBodyScrollLock\(/)
      if (/document\.body\.style\.overflow\s*=\s*["']hidden["']/.test(src)) {
        offenders.push(rel)
      }
    }
    expect(offenders, "no asignes body.style.overflow = hidden fuera del hook").toEqual([])
  })
})
