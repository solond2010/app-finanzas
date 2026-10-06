import { describe, expect, it } from "vitest"
import { parseLocalDate } from "./date-utils"

describe("parseLocalDate", () => {
  it("preserves date-only calendar days in timezones west of UTC", () => {
    const date = parseLocalDate("2026-10-05")
    const expected = new Date(2026, 9, 5)
    expect(date.getTime()).toBe(expected.getTime())
    expect(date.getDate()).toBe(5)
  })

  it("still parses timestamps as instants", () => {
    expect(parseLocalDate("2026-10-05T12:00:00Z").toISOString()).toBe("2026-10-05T12:00:00.000Z")
  })
})
