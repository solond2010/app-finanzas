import { describe, expect, it } from "vitest"
import { decideUpdate } from "./version-check"

describe("decideUpdate", () => {
  const base = { running: "aaa", remote: "bbb", safe: true, alreadyReloadedFor: null }
  it("no hace nada si la versión coincide o no se conoce", () => {
    expect(decideUpdate({ ...base, remote: "aaa" })).toBe("none")
    expect(decideUpdate({ ...base, remote: null })).toBe("none")
    expect(decideUpdate({ ...base, running: "dev" })).toBe("none")
    expect(decideUpdate({ ...base, remote: "dev" })).toBe("none")
  })
  it("recarga sola cuando es seguro", () => {
    expect(decideUpdate(base)).toBe("reload")
  })
  it("avisa en vez de recargar si hay algo abierto o se está escribiendo", () => {
    expect(decideUpdate({ ...base, safe: false })).toBe("prompt")
  })
  it("no entra en bucle si ya recargó por esa versión", () => {
    expect(decideUpdate({ ...base, alreadyReloadedFor: "bbb" })).toBe("prompt")
  })
})
