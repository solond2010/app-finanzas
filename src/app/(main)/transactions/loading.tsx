export default function TransactionsLoading() {
  return (
    <div className="space-y-7">
      <div className="skeleton-shimmer rounded-[32px] h-36 p-6 space-y-3">
        <div className="rounded-full h-5 w-40" />
        <div className="rounded-[12px] h-8 w-64" />
        <div className="rounded-[12px] h-4 w-48" />
      </div>
      <div className="skeleton-shimmer rounded-[24px] h-96 p-0 space-y-0">
        <div className="flex items-center gap-4 px-6 pt-6 pb-3">
          <div className="rounded-[8px] h-7 w-40" />
          <div className="rounded-[8px] h-7 w-32" />
          <div className="rounded-[8px] h-7 w-32 ml-auto" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-3 border-t border-border/20">
            <div className="rounded-[8px] h-4 w-16" />
            <div className="rounded-[8px] h-4 w-40 flex-1" />
            <div className="rounded-[8px] h-4 w-20" />
            <div className="rounded-[8px] h-4 w-24" />
            <div className="rounded-[8px] h-4 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
