import { currentUserIsAdmin } from "@/lib/server/require-admin"
import ConfiguracionClient from "./configuracion-client"

// El ajuste de ocultar Administración solo se importa y se pinta si el
// servidor confirma que quien está conectado es el admin.

export const dynamic = "force-dynamic"

export default async function ConfiguracionPage() {
  const isAdmin = await currentUserIsAdmin()
  const adminSettings = isAdmin ? await renderAdminSettings() : null
  return <ConfiguracionClient adminSettings={adminSettings} />
}

async function renderAdminSettings() {
  const { AdminVisibilityCard } = await import("@/components/settings/admin-visibility-card")
  return <AdminVisibilityCard />
}
