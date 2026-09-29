#!/usr/bin/env node
import { createHash, createHmac } from "node:crypto"
import { appendFile, chmod, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const DEFAULT_ENV_FILE = "/Users/mohamed/Desktop/app-finanzas/.env.local"
const DEFAULT_URL = "https://app-finanzas-henna.vercel.app/api/backup"
const envFile = process.env.FINANZAS_ENV_FILE || DEFAULT_ENV_FILE
const backupUrl = process.env.FINANZAS_BACKUP_URL || DEFAULT_URL
const backupDir = dirname(fileURLToPath(import.meta.url))

function envValue(contents, key) {
  const line = contents.split(/\r?\n/).find((entry) => entry.trimStart().startsWith(`${key}=`))
  if (!line) return null
  let value = line.slice(line.indexOf("=") + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  } else {
    value = value.replace(/\s+#.*$/, "")
  }
  return value || null
}

function csvCell(value) {
  const text = String(value ?? "")
  const safe = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

async function atomicWrite(path, contents) {
  const temporaryPath = `${path}.partial-${process.pid}`
  try {
    await writeFile(temporaryPath, contents, { flag: "wx", mode: 0o600 })
    await rename(temporaryPath, path)
  } catch (error) {
    await unlink(temporaryPath).catch(() => {})
    throw error
  }
}

async function log(message) {
  const path = join(backupDir, "monthly-backup.log")
  await appendFile(path, `${new Date().toISOString()} ${message}\n`, { mode: 0o600 }).catch(() => {})
  await chmod(path, 0o600).catch(() => {})
}

async function main() {
  await mkdir(backupDir, { recursive: true, mode: 0o700 })
  await chmod(backupDir, 0o700)
  const monthKey = new Date().toISOString().slice(0, 7)
  if ((await readdir(backupDir)).some((name) => name.startsWith(`app-finanzas-backup_${monthKey}-`) && name.endsWith(".json"))) {
    await log(`La copia de ${monthKey} ya existe; no se reemplaza.`)
    return
  }
  const password = envValue(await readFile(envFile, "utf8"), "APP_PASSWORD")
  if (!password) throw new Error(`No se encontró APP_PASSWORD en ${envFile}`)

  const session = createHmac("sha256", password).update("finanzas-app-auth-v1", "utf8").digest("hex")
  const response = await fetch(backupUrl, {
    headers: { Cookie: `app-auth=${session}`, Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`El servidor rechazó la copia (HTTP ${response.status})`)
  const payload = await response.json()
  const requiredTables = ["accounts", "transactions", "sinking_funds", "categories", "budgets", "watchlist", "investments", "investment_contributions", "settings"]
  if (payload?.app !== "app-finanzas" || payload?.formatVersion !== 1 || !payload.tables) {
    throw new Error("El servidor devolvió un formato de copia no reconocido")
  }
  for (const table of requiredTables) {
    if (!Array.isArray(payload.tables[table])) throw new Error(`La copia está incompleta: falta ${table}`)
  }
  if (payload.tables.accounts.length === 0 && payload.tables.transactions.length === 0) {
    throw new Error("La base de datos devolvió cero cuentas y cero movimientos; se evita guardar una copia vacía")
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "Z")
  const stem = `app-finanzas-backup_${stamp}`
  const json = `${JSON.stringify(payload, null, 2)}\n`
  const jsonPath = join(backupDir, `${stem}.json`)
  await atomicWrite(jsonPath, json)
  await atomicWrite(`${jsonPath}.sha256`, `${createHash("sha256").update(json).digest("hex")}  ${basename(jsonPath)}\n`)

  const accounts = new Map(payload.tables.accounts.map((account) => [account.id, account]))
  const csvRows = [
    ["id", "fecha", "tipo", "categoria", "descripcion", "importe", "cuenta", "divisa", "etiquetas"].map(csvCell).join(","),
    ...payload.tables.transactions.map((transaction) => {
      const account = accounts.get(transaction.cuenta_id)
      return [
        transaction.id,
        transaction.fecha,
        transaction.tipo,
        transaction.categoria,
        transaction.descripcion,
        transaction.monto,
        account?.nombre ?? transaction.cuenta_id,
        account?.currency ?? "EUR",
        Array.isArray(transaction.tags) ? transaction.tags.join("; ") : "",
      ].map(csvCell).join(",")
    }),
  ]
  await atomicWrite(join(backupDir, `${stem}-movimientos.csv`), `\uFEFF${csvRows.join("\r\n")}\r\n`)

  const counts = requiredTables.map((table) => `${table}=${payload.tables[table].length}`).join(" ")
  await log(`Copia completa guardada: ${basename(jsonPath)} (${counts})`)
  console.log(`Copia completa guardada: ${basename(jsonPath)} (${counts})`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Error inesperado"
  void log(`Error: ${message}`)
  process.exitCode = 1
})
