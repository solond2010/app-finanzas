// Bloque de carga compartido (mismo shimmer que ya usaba solo el Dashboard),
// para que ninguna página parpadee en blanco mientras useFinance() trae los
// datos de Supabase.
export function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-[16px] ${className ?? ""}`} />
}
