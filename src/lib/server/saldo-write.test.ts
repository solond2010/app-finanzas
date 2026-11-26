import { describe, expect, it } from "vitest"
import { accountsForSaldoSafeUpsert, netSaldoDeltasFromWrites, signedMonto, type LedgerTx } from "@/lib/server/saldo-write"

const acc = "acc-1"
const acc2 = "acc-2"

function tx(partial: Partial<LedgerTx> & { id: string }): LedgerTx {
  return { cuenta_id: acc, monto: 10, tipo: "gasto", ...partial }
}

function net(args: Parameters<typeof netSaldoDeltasFromWrites>[0]) {
  return netSaldoDeltasFromWrites(args)
}

describe("netSaldoDeltasFromWrites", () => {
  it("crear un gasto resta el saldo", () => {
    expect(net({ incoming: [tx({ id: "n1", tipo: "gasto", monto: 12.5 })], existing: [] })).toEqual([
      { accountId: acc, delta: -12.5 },
    ])
  })

  it("crear un ingreso suma el saldo", () => {
    expect(net({ incoming: [tx({ id: "n1", tipo: "ingreso", monto: 40 })], existing: [] })).toEqual([
      { accountId: acc, delta: 40 },
    ])
  })

  it("editar el importe solo aplica la diferencia", () => {
    expect(net({
      incoming: [tx({ id: "t1", tipo: "gasto", monto: 30 })],
      existing: [tx({ id: "t1", tipo: "gasto", monto: 10 })],
    })).toEqual([{ accountId: acc, delta: -20 }])
  })

  it("editar el signo (gasto a ingreso) invierte el efecto", () => {
    expect(net({
      incoming: [tx({ id: "t1", tipo: "ingreso", monto: 10 })],
      existing: [tx({ id: "t1", tipo: "gasto", monto: 10 })],
    })).toEqual([{ accountId: acc, delta: 20 }])
  })

  it("editar la cuenta saca el importe de una y lo pone en la otra", () => {
    expect(net({
      incoming: [tx({ id: "t1", tipo: "gasto", monto: 10, cuenta_id: acc2 })],
      existing: [tx({ id: "t1", tipo: "gasto", monto: 10, cuenta_id: acc })],
    })).toEqual([
      { accountId: acc, delta: 10 },
      { accountId: acc2, delta: -10 },
    ])
  })

  it("borrar un movimiento deshace su efecto en el saldo", () => {
    expect(net({
      incoming: [],
      existing: [tx({ id: "t1", tipo: "ingreso", monto: 8 })],
      deletedIds: ["t1"],
    })).toEqual([{ accountId: acc, delta: -8 }])
  })

  it("un traspaso mueve el saldo de las dos cuentas a la vez", () => {
    expect(net({
      incoming: [
        tx({ id: "out", tipo: "gasto", monto: 50, cuenta_id: acc }),
        tx({ id: "in", tipo: "ingreso", monto: 50, cuenta_id: acc2 }),
      ],
      existing: [],
    })).toEqual([
      { accountId: acc, delta: -50 },
      { accountId: acc2, delta: 50 },
    ])
  })

  it("un ajuste manual es un movimiento más: el servidor no usa un saldo absoluto", () => {
    expect(net({
      incoming: [tx({ id: "adj_1", tipo: "ingreso", monto: -15 })],
      existing: [],
    })).toEqual([{ accountId: acc, delta: -15 }])
  })

  it("un CSV que mantiene el saldo (importados + inicial reescrito) no mueve el saldo neto", () => {
    expect(net({
      incoming: [
        tx({ id: "init_acc-1", tipo: "ingreso", monto: 130 }),
        tx({ id: "csv-1", tipo: "gasto", monto: 30 }),
      ],
      existing: [tx({ id: "init_acc-1", tipo: "ingreso", monto: 100 })],
    })).toEqual([])
  })

  it("reenviar el mismo movimiento ya guardado (reintento o segundo dispositivo) no vuelve a mover el saldo", () => {
    const row = tx({ id: "t1", tipo: "gasto", monto: 10 })
    expect(net({ incoming: [row], existing: [row] })).toEqual([])
  })

  it("dos dispositivos desfasados: el segundo solo aplica lo que aún no estaba en el servidor", () => {
    // El servidor ya tiene el gasto de 10 del dispositivo A. El B, que partía
    // de un estado viejo, reenvía ese gasto y uno nuevo de 5.
    expect(net({
      incoming: [
        tx({ id: "from-a", tipo: "gasto", monto: 10 }),
        tx({ id: "from-b", tipo: "ingreso", monto: 5 }),
      ],
      existing: [tx({ id: "from-a", tipo: "gasto", monto: 10 })],
    })).toEqual([{ accountId: acc, delta: 5 }])
  })
})

describe("accountsForSaldoSafeUpsert", () => {
  it("nunca envía un saldo absoluto de una cuenta que ya existe", () => {
    const rows = accountsForSaldoSafeUpsert(
      [{ id: "acc-1", nombre: "Vieja", saldo: 999 }, { id: "acc-new", nombre: "Nueva", saldo: 100 }],
      new Set(["acc-1"]),
    )
    expect(rows[0]).toEqual({ id: "acc-1", nombre: "Vieja" })
    expect("saldo" in rows[0]).toBe(false)
    expect(rows[1]).toEqual({ id: "acc-new", nombre: "Nueva", saldo: 0 })
  })

  it("un cliente desactualizado no puede pisar el saldo con un valor viejo", () => {
    const rows = accountsForSaldoSafeUpsert(
      [{ id: "acc-1", saldo: 105, nombre: "A" }],
      new Set(["acc-1"]),
    )
    expect(rows[0].saldo).toBeUndefined()
  })
})

describe("signedMonto", () => {
  it("firma igual que el cliente", () => {
    expect(signedMonto("ingreso", 10)).toBe(10)
    expect(signedMonto("gasto", 10)).toBe(-10)
  })
})
