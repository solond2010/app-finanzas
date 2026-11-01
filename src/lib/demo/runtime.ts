import { createDemoApi } from "./fake-api"

// Activa el modo demo en ESTE navegador (pestaña): a partir de aquí ninguna
// llamada a /api sale a la red y localStorage/sessionStorage pasan a ser de
// memoria. Se llama al pintar el layout, antes de que los providers lean
// nada. No hay forma de desactivarlo sin una navegación completa (salir de la
// demo pasa por /demo/salir), así que nunca se mezcla con una sesión real.

let active = false

export function isDemoActive(): boolean {
  return active
}

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() { return this.map.size }
  clear() { this.map.clear() }
  getItem(key: string) { return this.map.has(String(key)) ? this.map.get(String(key))! : null }
  key(index: number) { return [...this.map.keys()][index] ?? null }
  removeItem(key: string) { this.map.delete(String(key)) }
  setItem(key: string, value: string) { this.map.set(String(key), String(value)) }
}

function replaceStorage(name: "localStorage" | "sessionStorage") {
  const memory = new MemoryStorage()
  try {
    Object.defineProperty(window, name, { configurable: true, enumerable: true, get: () => memory })
    if (window[name] === memory) return
  } catch { /* se intenta el plan B */ }
  // Plan B (navegadores que no dejan redefinir la propiedad): se desvían los
  // métodos de Storage. Aplica a ambos almacenes, que en la demo es lo que
  // queremos: nada se lee ni se escribe en el almacenamiento real.
  const proto = Storage.prototype as unknown as Record<string, unknown>
  if (proto.__garraDemo) return
  proto.__garraDemo = true
  proto.getItem = function (key: string) { return memory.getItem(key) }
  proto.setItem = function (key: string, value: string) { memory.setItem(key, value) }
  proto.removeItem = function (key: string) { memory.removeItem(key) }
  proto.clear = function () { memory.clear() }
  proto.key = function (index: number) { return memory.key(index) }
  try { Object.defineProperty(Storage.prototype, "length", { configurable: true, get: () => memory.length }) } catch { /* sin length */ }
}

export function enableDemoMode() {
  if (active || typeof window === "undefined") return
  active = true
  replaceStorage("localStorage")
  replaceStorage("sessionStorage")

  const api = createDemoApi()
  const realFetch = window.fetch.bind(window)
  const demoFetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : null
    const url = new URL(request ? request.url : String(input instanceof URL ? input.href : input), window.location.href)
    const sameOrigin = url.origin === window.location.origin
    if (!sameOrigin || !url.pathname.startsWith("/api/")) return realFetch(input as RequestInfo, init)
    // Única ruta que sí sale: la versión publicada (pública, sin datos).
    if (url.pathname === "/api/version") return realFetch(input as RequestInfo, init)
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase()
    let body: string | null = null
    if (typeof init?.body === "string") body = init.body
    else if (request && !init?.body) body = await request.clone().text().catch(() => null)
    return api.handle(method, url, body)
  }
  window.fetch = demoFetch
}
