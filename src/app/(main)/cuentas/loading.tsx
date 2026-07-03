export default function CuentasLoading() {
  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between">
        <div className="space-y-3 flex-1">
          <div className="skeleton-shimmer rounded-full h-5 w-32" />
          <div className="skeleton-shimmer rounded-[12px] h-8 w-64" />
          <div className="skeleton-shimmer rounded-[12px] h-4 w-48" />
        </div>
        <div className="skeleton-shimmer rounded-[16px] h-24 w-44" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer rounded-[16px] h-44 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-[12px] h-7 w-7" />
              <div className="rounded-[8px] h-3 w-20" />
            </div>
            <div className="rounded-[12px] h-8 w-36" />
            <div className="rounded-[8px] h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="skeleton-shimmer rounded-[16px] h-72" />
    </div>
  )
}
