export function MiniBarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex items-end gap-2 px-5 py-4" style={{ height: 140 }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-xs font-medium tabular-nums text-slate-600">
            {d.value || ""}
          </span>
          <div
            className="w-full rounded-t-sm bg-blue-500/80"
            style={{ height: `${Math.max((d.value / max) * 80, d.value > 0 ? 4 : 0)}px` }}
          />
          <span className="text-[11px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
