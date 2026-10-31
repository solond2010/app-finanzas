"use client"

import { useCallback, useSyncExternalStore } from "react"
import { dbDeleteIn, dbSelect, dbUpsert } from "./db-client"
import { parseGoalRows, sortGoals, type WealthGoal } from "./wealth-goals"

// Objetivos de patrimonio del usuario (tabla wealth_goals). Un único almacén
// en memoria compartido por Inicio y Analíticas: se pide una vez y, al
// guardar desde «Editar objetivos», las dos pantallas se actualizan a la vez.

type Snapshot = { goals: WealthGoal[]; loaded: boolean; failed: boolean }
let snapshot: Snapshot = { goals: [], loaded: false, failed: false }
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(next: Snapshot) {
  snapshot = next
  listeners.forEach((l) => l())
}

function load() {
  if (inflight || snapshot.loaded) return
  inflight = dbSelect<Record<string, unknown>>("wealth_goals")
    .then((rows) => emit({ goals: parseGoalRows(rows ?? []), loaded: true, failed: rows === null }))
    .finally(() => { inflight = null })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  load()
  return () => { listeners.delete(listener) }
}

const SERVER_SNAPSHOT: Snapshot = { goals: [], loaded: false, failed: false }

/** Guarda la lista completa: borra los que ya no están y guarda el resto. */
async function saveGoals(next: WealthGoal[]): Promise<void> {
  const sorted = sortGoals(next)
  const keep = new Set(sorted.map((g) => g.id))
  const removed = snapshot.goals.filter((g) => !keep.has(g.id)).map((g) => g.id)
  if (removed.length) await dbDeleteIn("wealth_goals", removed)
  if (sorted.length) await dbUpsert("wealth_goals", sorted.map((g) => ({ id: g.id, amount: g.amount, name: g.name })))
  emit({ goals: sorted, loaded: true, failed: false })
}

export function useWealthGoals() {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT)
  const save = useCallback((next: WealthGoal[]) => saveGoals(next), [])
  return { goals: snap.goals, loaded: snap.loaded, failed: snap.failed, save }
}

/** Abre «Editar objetivos» desde cualquier pantalla (el diálogo vive en el layout). */
export const OPEN_GOALS_EDITOR_EVENT = "garra:open-goals-editor"
export function openGoalsEditor() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_GOALS_EDITOR_EVENT))
}
