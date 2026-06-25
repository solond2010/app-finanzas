export default function CuentasLoading() {
  return (
    <div className="space-y-7">
      <div className="skeleton-shimmer rounded-[32px] h-44" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-shimmer rounded-[22px] h-44" />)}
      </div>
      <div className="skeleton-shimmer rounded-[24px] h-64" />
    </div>
  )
}
