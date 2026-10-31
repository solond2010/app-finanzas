import { describe, expect, it } from "vitest"
import { ACCOUNT_COLORS, accountColor, colorDistance, defaultAccountColor, distinctAccountColors, TOO_CLOSE } from "./account-colors"

describe("account colors", () => {
  it("has 16 distinguishable palette colours", () => {
    expect(ACCOUNT_COLORS).toHaveLength(16)
    expect(new Set(ACCOUNT_COLORS.map((c) => c.hex)).size).toBe(16)
  })

  it("keeps a valid colour and gives a stable default otherwise", () => {
    expect(accountColor({ id: "a", color: "#ff6b5b" })).toBe("#FF6B5B")
    expect(accountColor({ id: "abc", color: "" })).toBe(defaultAccountColor("abc"))
    expect(accountColor({ id: "abc", color: null })).toBe(accountColor({ id: "abc" }))
    expect(accountColor({ id: "abc", color: "red" })).toBe(defaultAccountColor("abc"))
  })

  it("separates accounts whose colours would be confused in a chart", () => {
    const map = distinctAccountColors([
      { id: "1", color: "#F5A524" },
      { id: "2", color: "#F5A626" },
      { id: "3", color: "#3B82F6" },
    ])
    expect(map.get("1")).toBe("#F5A524")
    expect(map.get("3")).toBe("#3B82F6")
    expect(colorDistance(map.get("1")!, map.get("2")!)).toBeGreaterThanOrEqual(TOO_CLOSE)
  })
})
