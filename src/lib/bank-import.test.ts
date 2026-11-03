import { describe, expect, it } from "vitest"
import { decodeBytes, findDuplicates, parseBankAmount, parseBankDate, readBankCsv, toMovements } from "./bank-import"

const run = (csv: string) => {
  const table = readBankCsv(csv)
  if (!table) throw new Error("sin tabla")
  return { table, ...toMovements(table) }
}

describe("importes y fechas", () => {
  it("entiende los formatos de importe de los bancos", () => {
    expect(parseBankAmount("-1.234,56")).toBe(-1234.56)
    expect(parseBankAmount("1,234.56", ".")).toBe(1234.56)
    expect(parseBankAmount("12,00 €")).toBe(12)
    expect(parseBankAmount("(45,10)")).toBe(-45.1)
    expect(parseBankAmount("30,00-")).toBe(-30)
    expect(parseBankAmount("+2.350")).toBe(2350)
    expect(parseBankAmount("abc")).toBeNull()
  })
  it("entiende los formatos de fecha", () => {
    expect(parseBankDate("03/10/2026")).toBe("2026-10-03")
    expect(parseBankDate("3-10-26")).toBe("2026-10-03")
    expect(parseBankDate("03.10.2026")).toBe("2026-10-03")
    expect(parseBankDate("2026-10-03 12:34:56")).toBe("2026-10-03")
    expect(parseBankDate("03 oct 2026")).toBe("2026-10-03")
    expect(parseBankDate("10/03/2026", "mdy")).toBe("2026-10-03")
    expect(parseBankDate("31/02/2026")).toBeNull()
  })
  it("decodifica Latin-1 si no es UTF-8", () => {
    const bytes = new Uint8Array([0x4e, 0xf3, 0x6d, 0x69, 0x6e, 0x61]) // «Nómina» en Latin-1
    expect(decodeBytes(bytes.buffer)).toBe("Nómina")
  })
})

describe("extractos de bancos", () => {
  it("BBVA: líneas de cabecera previas, punto y coma y coma decimal", () => {
    const { movements, table } = run(`Últimos movimientos;;;;
Titular: Ana López;;;;
F.Valor;Fecha;Concepto;Movimiento;Importe;Divisa;Disponible
02/10/2026;02/10/2026;MERCADONA VALENCIA;Pago con tarjeta;-45,30;EUR;1.954,70
28/10/2026;28/10/2026;NOMINA ACME SL;Abono de nómina;2.350,00;EUR;4.304,70`)
    expect(table.delimiter).toBe(";")
    expect(movements).toEqual([
      { row: 0, fecha: "2026-10-02", descripcion: "MERCADONA VALENCIA", monto: 45.3, tipo: "gasto" },
      { row: 1, fecha: "2026-10-28", descripcion: "NOMINA ACME SL", monto: 2350, tipo: "ingreso" },
    ])
  })
  it("ING: coma como separador, importes entre comillas", () => {
    const { movements } = run(`F. VALOR,CATEGORÍA,SUBCATEGORÍA,DESCRIPCIÓN,COMENTARIO,IMPORTE (€),SALDO (€)
"05/10/2026","Compras","Supermercado","Pago en LIDL","","-23,10","1.200,00"
"06/10/2026","Ingresos","Bizum","Bizum de Juan","","15,00","1.215,00"`)
    expect(movements.map((m) => [m.fecha, m.descripcion, m.monto, m.tipo])).toEqual([["2026-10-05", "Pago en LIDL", 23.1, "gasto"], ["2026-10-06", "Bizum de Juan", 15, "ingreso"]])
  })
  it("Sabadell: barra vertical y columnas F. Operativa", () => {
    const { movements } = run(`F. Operativa|Concepto|F. Valor|Importe|Saldo|Referencia 1
07/10/2026|RECIBO IBERDROLA|07/10/2026|-62,15|900,00|X1`)
    expect(movements[0]).toMatchObject({ fecha: "2026-10-07", descripcion: "RECIBO IBERDROLA", monto: 62.15, tipo: "gasto" })
  })
  it("Revolut: fechas ISO con hora y punto decimal", () => {
    const { movements } = run(`Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-10-08 10:12:00,2026-10-09 08:00:00,Spotify,-11.99,0.00,EUR,COMPLETED,500.01
TOPUP,Current,2026-10-10 09:00:00,2026-10-10 09:00:01,Top-up by *1234,1000.00,0.00,EUR,COMPLETED,1500.01`)
    expect(movements.map((m) => [m.fecha, m.descripcion, m.monto, m.tipo])).toEqual([["2026-10-09", "Spotify", 11.99, "gasto"], ["2026-10-10", "Top-up by *1234", 1000, "ingreso"]])
  })
  it("N26: comillas, Payee y Amount (EUR)", () => {
    const { movements } = run(`"Date","Payee","Account number","Transaction type","Payment reference","Amount (EUR)"
"2026-10-11","Amazon","","MasterCard Payment","","-34.99"`)
    expect(movements[0]).toMatchObject({ fecha: "2026-10-11", descripcion: "Amazon", monto: 34.99, tipo: "gasto" })
  })
  it("Debe y Haber en columnas separadas (CaixaBank, Santander antiguos)", () => {
    const { movements } = run(`Fecha;Concepto;Debe;Haber;Saldo
12/10/2026;TRANSFERENCIA RECIBIDA;;300,00;1.300,00
13/10/2026;COMPRA CORTE INGLES;89,90;;1.210,10
Saldo final;;;;1.210,10`)
    expect(movements.map((m) => [m.monto, m.tipo])).toEqual([[300, "ingreso"], [89.9, "gasto"]])
  })
})

describe("exportación de Garra", () => {
  it("usa la columna tipo para el signo", () => {
    const { movements } = run(`fecha,tipo,categoria,descripcion,monto,cuenta,tags
2026-10-01,gasto,Alquiler,Alquiler piso,850,Cuenta nómina,
2026-10-28,ingreso,Salario,Nómina,2350,Cuenta nómina,`)
    expect(movements.map((m) => [m.descripcion, m.tipo, m.monto])).toEqual([["Alquiler piso", "gasto", 850], ["Nómina", "ingreso", 2350]])
  })
})

describe("duplicados", () => {
  it("marca como duplicado el mismo día, importe y descripción parecida", () => {
    const movements = [
      { row: 0, fecha: "2026-10-02", descripcion: "MERCADONA VALENCIA", monto: 45.3, tipo: "gasto" as const },
      { row: 1, fecha: "2026-10-02", descripcion: "Cine", monto: 45.3, tipo: "gasto" as const },
    ]
    const dup = findDuplicates(movements, [{ fecha: "2026-10-02", monto: 45.3, tipo: "gasto", descripcion: "Mercadona" }])
    expect([...dup]).toEqual([0])
  })
})
