import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/server/require-admin"

// La comprobación va en el servidor. Si no es el admin, esta página no existe
// (404) y el panel ni siquiera se importa en la respuesta.

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const ctx = await requireAdmin()
  if (!ctx) notFound()
  const { default: AdminDashboard } = await import("./admin-dashboard")
  return <AdminDashboard />
}
