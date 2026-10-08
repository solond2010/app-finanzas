import { describe, expect, it } from "vitest"
import { dateKeyInTimeZone, isDateKey, localDateKey, parseLocalDate } from "./date-utils"

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

describe("localDateKey", () => {
  it("formats the local calendar date without shifting it through UTC", () => {
    expect(localDateKey(new Date(2026, 9, 8, 0, 15))).toBe("2026-10-08")
  })

  it("formats the intended calendar day in Madrid when the server clock is UTC", () => {
    expect(dateKeyInTimeZone(new Date("2026-10-07T22:30:00Z"), "Europe/Madrid")).toBe("2026-10-08")
  })
})

describe("isDateKey", () => {
  it("rejects impossible calendar dates", () => {
    expect(isDateKey("2026-10-08")).toBe(true)
    expect(isDateKey("2026-02-30")).toBe(false)
    expect(isDateKey("08/10/2026")).toBe(false)
  })
})
