#!/usr/bin/env node
// FASE 1 · Opción A: crea la cuenta de Moha en Supabase Auth con el MISMO id
// que ya tienen todos sus datos, así no hay que mover ninguna fila.
//
// Uso (desde la carpeta del proyecto):
//   node scripts/fase1-crear-cuenta-moha.mjs <email> [archivo-env]
// El archivo env (por defecto .env.local) debe tener SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY del proyecto DONDE se quiere crear la cuenta.
// No imprime ninguna clave. La cuenta se crea sin contraseña: Moha entra la
// primera vez con "Entra con un enlace por email" y pone su contraseña en
// Configuración → Tu cuenta.
import { readFile } from "node:fs/promises"

const LEGACY_USER_ID = "8c449806-d8b4-498a-98d7-28809bb7c95a"
const email = (process.argv[2] || "").trim().toLowerCase()
const envFile = process.argv[3] || ".env.local"
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Uso: node scripts/fase1-crear-cuenta-moha.mjs <email> [archivo-env]")
  process.exit(1)
}

function envValue(contents, key) {
  const line = contents.split(/\r?\n/).find((l) => l.trimStart().startsWith(`${key}=`))
  if (!line) return null
  let v = line.slice(line.indexOf("=") + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  return v || null
}

const env = await readFile(envFile, "utf8")
const url = process.env.SUPABASE_URL || envValue(env, "SUPABASE_URL")
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envValue(env, "SUPABASE_SERVICE_ROLE_KEY")
if (!url || !serviceKey) {
  console.error(`Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ${envFile}`)
  process.exit(1)
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }
const existing = await fetch(`${url}/auth/v1/admin/users/${LEGACY_USER_ID}`, { headers })
if (existing.ok) {
  const user = await existing.json()
  console.log(`Ya existe la cuenta con el id de los datos (${user.email}). No se cambia nada.`)
  process.exit(0)
}

const res = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers,
  body: JSON.stringify({ id: LEGACY_USER_ID, email, email_confirm: true }),
})
const body = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error(`Supabase rechazó la creación (HTTP ${res.status}): ${body.msg || body.message || body.error_description || "sin detalle"}`)
  process.exit(1)
}
console.log(`Cuenta creada para ${body.email} con el id de los datos existentes. Ya puede entrar con "enlace por email".`)
