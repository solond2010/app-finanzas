import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { password } = await request.json()
  const expected = process.env.APP_PASSWORD

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set("app-auth", password, {
    httpOnly: true,
    // "Secure" hace que el navegador descarte la cookie en conexiones sin
    // cifrar (http://, como el servidor de dev local o una preview servida
    // por http). En producción (Vercel, siempre https) sí debe ir activado.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
