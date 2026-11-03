import { describe, expect, it } from "vitest"
import { cleanRoute, createRateLimiter, isIgnorableClientError, sanitizeErrorReport, scrubText } from "./error-report"

describe("avisos de error sin datos personales", () => {
  it("tapa importes, emails, claves y números largos", () => {
    const out = scrubText("Saldo 1.525,25 € de ana@correo.es con clave fz_abcdefghijkl y IBAN ES9121000418450200051332")
    expect(out).not.toMatch(/1\.525/)
    expect(out).not.toMatch(/ana@correo/)
    expect(out).not.toMatch(/fz_abcdefghijkl/)
    expect(out).not.toMatch(/9121000418450200051332/)
  })
  it("quita la query de la ruta", () => {
    expect(cleanRoute("/transactions?q=alquiler#x")).toBe("/transactions")
  })
  it("recorta textos largos y pone mensaje por defecto", () => {
    const r = sanitizeErrorReport({ message: "x".repeat(5000), stack: "y".repeat(9000), route: "/a" }, "navegador")
    expect(r.message.length).toBeLessThanOrEqual(1000)
    expect(r.stack!.length).toBeLessThanOrEqual(4000)
    expect(sanitizeErrorReport({}, "servidor").message).toBe("Error sin mensaje")
  })
  it("ignora ruido del navegador", () => {
    expect(isIgnorableClientError("ResizeObserver loop limit exceeded")).toBe(true)
    expect(isIgnorableClientError("Cannot read properties of undefined")).toBe(false)
    expect(isIgnorableClientError("undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')")).toBe(true)
    expect(isIgnorableClientError("Can't find variable: __firefox__")).toBe(true)
    expect(isIgnorableClientError("undefined is not an object (evaluating 'window.__firefox__.reader')")).toBe(true)
  })
  it("limita la frecuencia", () => {
    const allow = createRateLimiter(2, 1000)
    expect(allow("a", 0)).toBe(true)
    expect(allow("a", 10)).toBe(true)
    expect(allow("a", 20)).toBe(false)
    expect(allow("a", 2000)).toBe(true)
  })
})
