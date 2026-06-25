export default function CuentaDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton-shimmer rounded-[32px] h-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-shimmer rounded-[24px] h-28" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="skeleton-shimmer rounded-[24px] h-32" />
        <div className="skeleton-shimmer rounded-[24px] h-32" />
      </div>
      <div className="skeleton-shimmer rounded-[24px] h-96" />
    </div>
  )
}
