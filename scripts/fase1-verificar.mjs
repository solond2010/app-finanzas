#!/usr/bin/env node
// FASE 1 · Comprueba, tras el cambio, que la cuenta de Moha tiene al menos
// las mismas filas que la copia hecha antes de la fase 1.
// Uso: node scripts/fase1-verificar.mjs "<copia.json>" [url-backup] [archivo-env]
// Usa SHORTCUTS_SECRET (que apunta a la cuenta de Moha). No imprime claves.
import { readFile } from "node:fs/promises"

const [backupPath, backupUrl = "https://app-finanzas-henna.vercel.app/api/backup", envFile = ".env.local"] = process.argv.slice(2)
if (!backupPath) { console.error("Uso: node scripts/fase1-verificar.mjs <copia.json> [url] [env]"); process.exit(1) }

const env = await readFile(envFile, "utf8")
const line = env.split(/\r?\n/).find((l) => l.trimStart().startsWith("SHORTCUTS_SECRET="))
const secret = line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")
if (!secret) { console.error(`Falta SHORTCUTS_SECRET en ${envFile}`); process.exit(1) }

const before = JSON.parse(await readFile(backupPath, "utf8")).tables
const res = await fetch(backupUrl, { headers: { "x-shortcuts-secret": secret, Accept: "application/json" } })
if (!res.ok) { console.error(`El servidor respondió HTTP ${res.status}`); process.exit(1) }
const now = (await res.json()).tables

let ok = true
for (const [table, rows] of Object.entries(before)) {
  const n = now[table]?.length ?? 0
  const missing = rows.filter((r) => !now[table]?.some((x) => (x.id ?? x.key ?? x.symbol) === (r.id ?? r.key ?? r.symbol))).length
  const status = missing === 0 ? "OK" : "FALTAN"
  if (missing) ok = false
  console.log(`${status.padEnd(6)} ${table.padEnd(26)} antes ${String(rows.length).padStart(4)} · ahora ${String(n).padStart(4)}${missing ? ` · faltan ${missing}` : ""}`)
}
process.exit(ok ? 0 : 2)
