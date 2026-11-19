import { json } from "@/lib/server/auth-helpers"
import { requireAdmin } from "@/lib/server/require-admin"
import { listAdminUsers } from "@/lib/server/list-admin-users"

// Listado de usuarios y planes. Solo el admin. Usa la clave de servicio en
// el servidor para leer auth.users y user_plans; nunca se envía al cliente.
const notFound = () => json({ error: "No encontrado" }, 404)

export async function GET() {
  const ctx = await requireAdmin()
  if (!ctx) return notFound()
  try {
    const data = await listAdminUsers()
    return json(data)
  } catch (error) {
    console.warn("[admin] no se pudo listar usuarios:", error instanceof Error ? error.message : error)
    return json({ error: "No se pudieron cargar los usuarios" }, 500)
  }
}
