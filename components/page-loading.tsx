export function PageLoading() {
  return (
    <div
      className="flex min-h-full w-full flex-col gap-6 p-6"
      role="status"
      aria-live="polite"
      aria-label="Carregando página"
    >
      <div className="flex items-center gap-3 text-sm font-medium text-slate-300">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" />
        Carregando dados...
      </div>

      <div className="h-20 animate-pulse rounded-lg border border-white/5 bg-white/[0.03]" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-lg border border-white/5 bg-white/[0.03]" />
        <div className="h-28 animate-pulse rounded-lg border border-white/5 bg-white/[0.03]" />
        <div className="h-28 animate-pulse rounded-lg border border-white/5 bg-white/[0.03]" />
      </div>
      <div className="h-72 animate-pulse rounded-lg border border-white/5 bg-white/[0.03]" />
    </div>
  );
}
