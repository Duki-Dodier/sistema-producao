export function StatCard({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: number | string;
  accent?: "neutral" | "success" | "warning" | "danger";
}) {
  const accentClasses = {
    neutral: "bg-[#2C3645] border-white/5",
    success: "bg-[#2C3645] border-emerald-500/30",
    warning: "bg-[#2C3645] border-amber-500/30",
    danger: "bg-[#2C3645] border-red-500/30",
  };

  const textClasses = {
    neutral: "text-slate-100",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  };

  return (
    <div
      className={`flex flex-col rounded-lg border px-5 py-4 shadow-xl ${accentClasses[accent]}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className={`mt-1 text-3xl font-light ${textClasses[accent]}`}>
        {value}
      </span>
    </div>
  );
}
