import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings } from "lucide-react"

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">Ajustes de la aplicación</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Preferencias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Próximamente: personalización de categorías, moneda y más.</p>
        </CardContent>
      </Card>
    </div>
  )
}
