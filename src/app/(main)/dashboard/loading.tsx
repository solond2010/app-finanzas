export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="skeleton-shimmer rounded-[36px] h-[280px]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-shimmer rounded-[24px] h-32" />)}
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="skeleton-shimmer col-span-full xl:col-span-7 rounded-[24px] h-[380px]" />
        <div className="col-span-full xl:col-span-5 space-y-4">
          <div className="skeleton-shimmer rounded-[24px] h-48" />
          <div className="skeleton-shimmer rounded-[24px] h-48" />
        </div>
      </div>
    </div>
  )
}
