import { describe, it, expect } from "vitest"
import { parseCsv, detectDelimiter, normalizeDate } from "./csv-import"

describe("detectDelimiter", () => {
  it("detecta punto y coma en exportaciones bancarias españolas", () => {
    expect(detectDelimiter("fecha;tipo;monto;cuenta")).toBe(";")
  })
  it("detecta coma por defecto", () => {
    expect(detectDelimiter("fecha,tipo,monto,cuenta")).toBe(",")
  })
  it("detecta tabulador", () => {
    expect(detectDelimiter("fecha\ttipo\tmonto\tcuenta")).toBe("\t")
  })
  it("ignora delimitadores dentro de comillas", () => {
    expect(detectDelimiter('"a;b;c",tipo,monto,cuenta')).toBe(",")
  })
})

describe("parseCsv", () => {
  it("parsea filas con punto y coma y coma decimal", () => {
    const text = "fecha;tipo;categoria;descripcion;monto;cuenta\n03/07/2026;gasto;Ocio;Cena con amigos;25,50;Suiza\n01/07/2026;ingreso;Salario;Nomina;1200;Suiza\n"
    const rows = parseCsv(text, ";")
    expect(rows).toHaveLength(3)
    expect(rows[1]).toEqual(["03/07/2026", "gasto", "Ocio", "Cena con amigos", "25,50", "Suiza"])
  })
  it("respeta campos entrecomillados que contienen el delimitador", () => {
    const text = 'fecha,descripcion\n2026-07-03,"Cena, con amigos"\n'
    const rows = parseCsv(text, ",")
    expect(rows[1]).toEqual(["2026-07-03", "Cena, con amigos"])
  })
  it("descarta filas completamente vacías", () => {
    const text = "a,b\n1,2\n\n\n3,4\n"
    const rows = parseCsv(text, ",")
    expect(rows).toHaveLength(3)
  })
})

describe("normalizeDate", () => {
  it("normaliza dd/mm/aaaa", () => {
    expect(normalizeDate("03/07/2026")).toBe("2026-07-03")
  })
  it("normaliza dd-mm-aaaa sin ceros a la izquierda", () => {
    expect(normalizeDate("3-7-2026")).toBe("2026-07-03")
  })
  it("deja pasar aaaa-mm-dd tal cual", () => {
    expect(normalizeDate("2026-07-03")).toBe("2026-07-03")
  })
  it("rechaza texto que no es una fecha", () => {
    expect(normalizeDate("no es una fecha")).toBeNull()
  })
})
