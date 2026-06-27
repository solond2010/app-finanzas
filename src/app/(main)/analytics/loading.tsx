export default function AnalyticsLoading() {
  return (
    <div className="space-y-7">
      <div className="skeleton-shimmer rounded-[32px] h-40 p-6 space-y-3">
        <div className="rounded-full h-5 w-40" />
        <div className="rounded-[12px] h-8 w-72" />
        <div className="rounded-[12px] h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-shimmer rounded-[24px] h-32 p-5 space-y-3">
          <div className="rounded-[8px] h-7 w-24" />
          <div className="rounded-[12px] h-8 w-32" />
          <div className="rounded-[8px] h-3 w-28" />
        </div>)}
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="skeleton-shimmer col-span-full xl:col-span-7 rounded-[24px] h-[350px]" />
        <div className="skeleton-shimmer col-span-full xl:col-span-5 rounded-[24px] h-[350px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-shimmer rounded-[22px] h-32" />)}
      </div>
      <div className="skeleton-shimmer rounded-[24px] h-64" />
    </div>
  )
}
