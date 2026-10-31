import { describe, expect, it } from "vitest"
import { generateApiToken, hashApiToken, looksLikeApiToken, tokenDisplayPrefix } from "./api-tokens"
import { userStoragePath, withUserId } from "./user-scope"
import { ensureLocalCacheOwner, LOCAL_OWNER_KEY, readCookie } from "./local-owner"
import { isPublicAuthPath, LEGACY_USER_ID } from "./auth-mode"

function memoryStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return {
    get length() { return m.size },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
    dump: () => Object.fromEntries(m),
  }
}

describe("claves de Atajos", () => {
  it("son aleatorias, con prefijo, y el hash es estable", async () => {
    const a = generateApiToken()
    const b = generateApiToken()
    expect(a).not.toBe(b)
    expect(looksLikeApiToken(a)).toBe(true)
    expect(looksLikeApiToken("1234")).toBe(false)
    expect(await hashApiToken(a)).toBe(await hashApiToken(a))
    expect(await hashApiToken(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenDisplayPrefix(a)).toHaveLength(9)
  })
})

describe("user-scope", () => {
  it("withUserId sobrescribe lo que mande el navegador", () => {
    expect(withUserId([{ id: "x", user_id: "otro" }], "yo")).toEqual([{ id: "x", user_id: "yo" }])
  })
  it("userStoragePath mete el archivo en la carpeta del usuario y rechaza '..'", () => {
    expect(userStoragePath("u1", "logo.png")).toBe("u1/logo.png")
    expect(userStoragePath("u1", "/u1/logo.png")).toBe("u1/logo.png")
    expect(userStoragePath("u1", "../u2/logo.png")).toBeNull()
  })
})

describe("caché local por usuario", () => {
  it("en modo contraseña única (sin cookie) no toca nada", () => {
    const s = memoryStorage({ "app-finanzas-data": "x" })
    expect(ensureLocalCacheOwner(s, "")).toBe(false)
    expect(s.dump()).toEqual({ "app-finanzas-data": "x" })
  })
  it("la copia de siempre de Moha se conserva al entrar con su cuenta", () => {
    const s = memoryStorage({ "app-finanzas-data": "moha" })
    expect(ensureLocalCacheOwner(s, `app-uid=${LEGACY_USER_ID}`)).toBe(false)
    expect(s.getItem("app-finanzas-data")).toBe("moha")
    expect(s.getItem(LOCAL_OWNER_KEY)).toBe(LEGACY_USER_ID)
  })
  it("si entra otra persona en el mismo navegador se borra la copia anterior (menos el tema)", () => {
    const s = memoryStorage({ "app-finanzas-data": "moha", "app-finanzas-theme": "dark", [LOCAL_OWNER_KEY]: LEGACY_USER_ID })
    expect(ensureLocalCacheOwner(s, "foo=1; app-uid=otro-usuario")).toBe(true)
    expect(s.dump()).toEqual({ "app-finanzas-theme": "dark", [LOCAL_OWNER_KEY]: "otro-usuario" })
  })
  it("una copia sin dueño NO se regala a una cuenta nueva", () => {
    const s = memoryStorage({ "app-finanzas-data": "de alguien" })
    expect(ensureLocalCacheOwner(s, "app-uid=nuevo")).toBe(true)
    expect(s.getItem("app-finanzas-data")).toBeNull()
  })
  it("readCookie", () => {
    expect(readCookie("a=1; app-uid=xyz", "app-uid")).toBe("xyz")
    expect(readCookie("a=1", "app-uid")).toBeNull()
  })
})

describe("rutas públicas", () => {
  it("solo login, callback y la API de auth", () => {
    expect(isPublicAuthPath("/login")).toBe(true)
    expect(isPublicAuthPath("/auth/callback")).toBe(true)
    expect(isPublicAuthPath("/api/auth/login")).toBe(true)
    expect(isPublicAuthPath("/dashboard")).toBe(false)
    expect(isPublicAuthPath("/api/data/accounts")).toBe(false)
  })
})
