import { describe, expect, it } from "vitest"
import {
  importantTodayKinds,
  isDismissedThisMonth,
  madridMonthKey,
  monthlySummaryHeading,
} from "./dashboard-banners"

describe("título del resumen del mes pasado", () => {
  it("dice «Resumen de octubre», no «Has mejorado este mes»", () => {
    expect(monthlySummaryHeading("Octubre 2026")).toBe("Resumen de octubre")
    expect(monthlySummaryHeading("Enero 2027")).toBe("Resumen de enero")
  })
})

describe("cerrar un aviso hasta el mes siguiente (Europe/Madrid)", () => {
  it("sigue oculto en el mes en que se cerró y reaparece al cambiar de mes", () => {
    expect(isDismissedThisMonth("2026-11", "2026-11")).toBe(true)
    expect(isDismissedThisMonth("2026-11", "2026-12")).toBe(false)
    expect(isDismissedThisMonth("2026-10", "2026-11")).toBe(false)
  })

  it("si no hay cierre guardado, o el valor no es un mes, se muestra", () => {
    expect(isDismissedThisMonth(null, "2026-11")).toBe(false)
    expect(isDismissedThisMonth(undefined, "2026-11")).toBe(false)
    expect(isDismissedThisMonth("no-es-un-mes", "2026-11")).toBe(false)
  })

  it("madridMonthKey usa Europe/Madrid (YYYY-MM)", () => {
    expect(madridMonthKey(new Date("2026-11-01T00:30:00+01:00"))).toBe("2026-11")
    // Aún es 30 de noviembre en Madrid, ya 1 de diciembre en UTC+13.
    expect(madridMonthKey(new Date("2026-11-30T23:30:00+01:00"))).toBe("2026-11")
  })
})

describe("Lo importante hoy", () => {
  it("ya no genera el aviso genérico del colchón / siguiente paso", () => {
    expect(importantTodayKinds({ upcomingFixed: false, unusualOrBudget: false })).toEqual([])
    expect(importantTodayKinds({ upcomingFixed: true, unusualOrBudget: false })).toEqual(["fijo"])
    expect(importantTodayKinds({ upcomingFixed: false, unusualOrBudget: true })).toEqual(["dispara"])
    expect(importantTodayKinds({ upcomingFixed: true, unusualOrBudget: true })).toEqual(["fijo", "dispara"])
  })
})
