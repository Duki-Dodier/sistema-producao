export function ProgressBar({
  percentual,
  variant = "default",
}: {
  percentual: number;
  variant?: "default" | "success" | "warning";
}) {
  const color =
    variant === "success"
      ? "bg-emerald-500"
      : variant === "warning"
        ? "bg-amber-500"
        : "bg-blue-600";

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${color} transition-all`}
        style={{ width: `${Math.min(Math.max(percentual, 2), 100)}%` }}
      />
    </div>
  );
}
