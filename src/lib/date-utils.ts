/** Parse date-only ISO values as calendar dates in the current locale, not UTC instants. */
export function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return new Date(value)
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

