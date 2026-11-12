import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const root = resolve(__dirname, "../..")
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8")

describe("altura estable del shell (Android Chrome)", () => {
  it("el shell y el body usan 100svh, no 100vh/100dvh", () => {
    const shell = read("src/app/(main)/main-shell.tsx")
    const layout = read("src/app/layout.tsx")
    const css = read("src/app/globals.css")

    expect(shell).toMatch(/min-h-svh/)
    expect(shell).not.toMatch(/min-h-screen/)
    expect(shell).not.toMatch(/min-h-dvh/)
    expect(shell).toMatch(/overflow-x-clip/)
    expect(shell).not.toMatch(/overflow-x-hidden/)

    expect(layout).toMatch(/min-h-svh/)
    expect(layout).not.toMatch(/body className="min-h-screen/)

    expect(css).toMatch(/min-height:\s*100svh/)
    expect(css).toMatch(/pointer:\s*coarse[\s\S]*scroll-behavior:\s*auto/)
  })
})
