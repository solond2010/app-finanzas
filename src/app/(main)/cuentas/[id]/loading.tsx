export default function CuentaDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton-shimmer rounded-[12px] h-5 w-20" />
      <div className="skeleton-shimmer rounded-[24px] h-56 p-6 sm:p-8 space-y-4">
        <div className="rounded-full h-5 w-32" />
        <div className="rounded-[12px] h-10 w-72" />
        <div className="rounded-full h-4 w-28" />
        <div className="rounded-[12px] h-12 w-48" />
      </div>
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
