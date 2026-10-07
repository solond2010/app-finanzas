import { redirect } from "next/navigation"

/** Ruta conservada como alias para no dejar enlaces antiguos rotos. */
export default function InvestmentsRedirect() {
  redirect("/cuentas")
}
