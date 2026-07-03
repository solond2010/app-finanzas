export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton-shimmer rounded-[16px] h-32 sm:h-36" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-shimmer rounded-[16px] h-28" />)}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="skeleton-shimmer rounded-[16px] h-[340px]" />
          <div className="skeleton-shimmer rounded-[16px] h-[220px]" />
        </div>
        <div className="space-y-5">
          <div className="skeleton-shimmer rounded-[16px] h-[280px]" />
          <div className="skeleton-shimmer rounded-[16px] h-[260px]" />
        </div>
      </div>
      <div className="skeleton-shimmer rounded-[16px] h-64" />
    </div>
  )
}
