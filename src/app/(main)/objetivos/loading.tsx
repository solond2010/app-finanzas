export default function ObjetivosLoading() {
  return (
    <div className="space-y-7">
      <div className="skeleton-shimmer rounded-[24px] h-40 p-6 sm:p-8 space-y-3">
        <div className="rounded-full h-5 w-40" />
        <div className="rounded-[12px] h-8 w-72" />
        <div className="rounded-[12px] h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-shimmer rounded-[24px] h-28 p-5 space-y-3">
          <div className="rounded-[8px] h-7 w-24" />
          <div className="rounded-[12px] h-8 w-32" />
        </div>)}
      </div>
      <div className="skeleton-shimmer rounded-[24px] h-64" />
    </div>
  )
}
