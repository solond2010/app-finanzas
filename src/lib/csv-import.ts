// Lógica de parseo pura para la importación de CSV (sin dependencias de UI),
// para que sea testeable de forma aislada — ver csv-import.test.ts.

// Lee el fichero como UTF-8; si no es UTF-8 válido (bytes que no forman una
// secuencia válida, típico de un CSV exportado por un banco español en
// Windows-1252/Latin-1), reintenta con esa codificación en vez de dejar que
// los acentos y el símbolo € salgan como caracteres corruptos.
export async function readFileSmart(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder("windows-1252").decode(buf)
  }
}

// La coma es el separador "estándar" de CSV, pero las exportaciones de banca
// española suelen usar punto y coma (para no chocar con la coma decimal) o,
// más raro, tabulador. Se cuenta cuál aparece más veces en la cabecera fuera
// de comillas y se usa ese en todo el fichero.
export function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 }
  let inQuotes = false
  for (const c of headerLine) {
    if (c === '"') inQuotes = !inQuotes
    else if (!inQuotes && c in counts) counts[c]++
  }
  const [best] = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1])
  return (best[1] > 0 ? best[0] : ",") as "," | ";" | "\t"
}

export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(field); field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field); rows.push(row); row = []; field = ""
    } else field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}

// Fechas dd/mm/aaaa o dd-mm-aaaa (frecuentes en exportaciones bancarias) se
// normalizan a aaaa-mm-dd, el formato que usa el resto de la app.
export function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  return null
}
