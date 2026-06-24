import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"

export default function ObjetivosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Objetivos</h1>
        <p className="text-muted-foreground">Metas de ahorro y sinking funds</p>
      </div>
      <SinkingFundsGrid />
    </div>
  )
}
