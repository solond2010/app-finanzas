export default function ConfiguracionLoading() {
  return (
    <div className="space-y-7">
      <div className="skeleton-shimmer rounded-[24px] h-36 p-6 space-y-3">
        <div className="rounded-full h-5 w-40" />
        <div className="rounded-[12px] h-8 w-64" />
        <div className="rounded-[12px] h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="skeleton-shimmer rounded-[24px] h-64 p-5 space-y-4">
          <div className="rounded-[8px] h-5 w-32" />
          <div className="rounded-[8px] h-4 w-48" />
          <div className="rounded-[8px] h-10 w-full mt-6" />
          <div className="rounded-[8px] h-10 w-32 mt-2" />
        </div>
        <div className="skeleton-shimmer rounded-[24px] h-64 p-5 space-y-4">
          <div className="rounded-[8px] h-5 w-32" />
          <div className="rounded-[8px] h-4 w-48" />
          <div className="rounded-[8px] h-10 w-full mt-6" />
          <div className="rounded-[8px] h-10 w-32 mt-2" />
        </div>
      </div>
    </div>
  )
}
