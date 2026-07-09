import type { CSSProperties } from "react"
import { AlertTriangle, Lightbulb } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { FinancialTip } from "@/lib/calculations"
import { cn } from "@/lib/utils"

const SEVERITY_ICON = { critical: AlertTriangle, warning: AlertTriangle, info: Lightbulb }
const SEVERITY_COLOR = { critical: "text-red-500", warning: "text-amber-500", info: "text-blue-500" }

// Tarjeta de consejos reutilizable: reglas deterministas sobre los propios
// datos (getFinancialTips en calculations.ts), sin IA ni servicio externo.
// Mismo estilo que "Lo que ha cambiado este mes" de Analíticas.
export function TipsCard({ tips, className, style }: { tips: FinancialTip[]; className?: string; style?: CSSProperties }) {
  if (tips.length === 0) return null
  return (
    <Card className={cn("stagger-fade", className)} style={style}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold"><Lightbulb className="h-4 w-4 text-amber-500" />Consejos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tips.map((tip) => {
          const Icon = SEVERITY_ICON[tip.severity]
          return (
            <div key={tip.id} className="flex items-start gap-3 rounded-2xl bg-muted/35 p-3.5 ring-1 ring-border/20">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", SEVERITY_COLOR[tip.severity])} />
              <p className="text-sm leading-6">{tip.message}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
