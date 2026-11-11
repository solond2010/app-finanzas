/** Helpers to keep a cloud upsert from stalling when the client sends a
 *  column that the production schema does not have yet (migration lag).
 *  The pending payload is not discarded: unknown keys are stripped and the
 *  rest is retried so later tables (e.g. transactions) can still be saved.
 */

const POSTGREST_MISSING_COLUMN = /Could not find the '([^']+)' column/i
const PG_MISSING_COLUMN = /column "([^"]+)" of relation "[^"]+" does not exist/i
const PG_MISSING_COLUMN_SIMPLE = /column "([^"]+)" does not exist/i

export function missingColumnFromError(message: string): string | null {
  const match = message.match(POSTGREST_MISSING_COLUMN)
    ?? message.match(PG_MISSING_COLUMN)
    ?? message.match(PG_MISSING_COLUMN_SIMPLE)
  const column = match?.[1]?.trim()
  return column ? column : null
}

export function stripColumnFromRows(rows: Record<string, unknown>[], column: string): Record<string, unknown>[] {
  return rows.map((row) => {
    if (!(column in row)) return row
    const next = { ...row }
    delete next[column]
    return next
  })
}

export type UpsertError = { message: string }

export async function upsertIgnoringUnknownColumns(
  upsert: (rows: Record<string, unknown>[]) => Promise<{ error: UpsertError | null }>,
  rows: Record<string, unknown>[],
  maxStrips = 8,
): Promise<{ error: UpsertError | null; stripped: string[] }> {
  let payload = rows
  const stripped: string[] = []
  for (let attempt = 0; attempt <= maxStrips; attempt++) {
    const result = await upsert(payload)
    if (!result.error) return { error: null, stripped }
    const column = missingColumnFromError(result.error.message)
    if (!column || !payload.some((row) => Object.prototype.hasOwnProperty.call(row, column))) {
      return { error: result.error, stripped }
    }
    if (attempt === maxStrips) return { error: result.error, stripped }
    payload = stripColumnFromRows(payload, column)
    stripped.push(column)
  }
  return { error: { message: "Fallo al guardar" }, stripped }
}
