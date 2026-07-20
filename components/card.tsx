export function Card({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-lg border border-white/5 bg-[#202A36] shadow-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-white/5 bg-[#1A222C] px-5 py-3 rounded-t-lg">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[11px] text-slate-500 uppercase tracking-wide">{subtitle}</p>}
    </div>
  );
}
