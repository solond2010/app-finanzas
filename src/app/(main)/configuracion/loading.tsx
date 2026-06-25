export default function ConfiguracionLoading() {
  return (
    <div className="space-y-7">
      <div className="skeleton-shimmer rounded-[32px] h-44" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="skeleton-shimmer rounded-[24px] h-56" />
        <div className="skeleton-shimmer rounded-[24px] h-56" />
      </div>
    </div>
  )
}
