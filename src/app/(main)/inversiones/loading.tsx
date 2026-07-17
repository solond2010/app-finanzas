export default function InversionesLoading() {
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="skeleton-shimmer rounded-full h-5 w-24" />
          <div className="skeleton-shimmer rounded-[12px] h-8 w-56" />
          <div className="skeleton-shimmer rounded-[12px] h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-shimmer rounded-[12px] h-9 w-40" />
          <div className="skeleton-shimmer rounded-[12px] h-9 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer rounded-[16px] h-24" />
        ))}
      </div>
      <div className="skeleton-shimmer rounded-[16px] h-20" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer rounded-[16px] h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="skeleton-shimmer rounded-[16px] h-80" />
        <div className="skeleton-shimmer rounded-[16px] h-80" />
      </div>
    </div>
  )
}
