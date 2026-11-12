import { describe, expect, it } from "vitest"
import { dialogMaxFromClass } from "./dialog-max"

describe("dialogMaxFromClass", () => {
  it("respeta --dialog-max y anchos arbitrarios de las vistas ampliadas", () => {
    expect(dialogMaxFromClass("[--dialog-max:min(1100px,94vw)] sm:max-w-[min(1100px,94vw)]")).toBe("min(1100px,94vw)")
    expect(dialogMaxFromClass("sm:max-w-[min(1040px,calc(100%-3rem))]")).toBe("1040px")
    expect(dialogMaxFromClass("sm:max-w-xl")).toBe("36rem")
    expect(dialogMaxFromClass("max-w-md")).toBe("28rem")
  })
})
