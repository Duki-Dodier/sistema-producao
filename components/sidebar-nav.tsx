"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Painel Geral", icon: DashboardIcon },
  { href: "/monitoramento", label: "Monitoramento (Produção Geral)", icon: MonitorIcon },
  { href: "/ops", label: "Ordens de Produção", icon: OrdersIcon },
  { href: "/agrupamento", label: "Agrupamento (WIP)", icon: KittingIcon },
  { href: "/solda", label: "Soldagem", icon: WeldingIcon },
  { href: "/apontamentos", label: "Apontamentos da Fábrica", icon: QualityIcon },
  { href: "/modelos", label: "Engenharia de Produto", icon: ConfigIcon },
  { href: "/configuracoes", label: "Configurações (Funcionários, Metas)", icon: SettingsIcon },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col items-center gap-4 py-4 w-full">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label} // Tooltip nativo em Português
            className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all ${
              active
                ? "bg-[#3B82F6] text-white shadow-md shadow-blue-500/20"
                : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            
            {/* Tooltip customizado (aparece ao passar o mouse) */}
            <div className="pointer-events-none absolute left-14 z-50 flex hidden items-center opacity-0 transition-opacity group-hover:flex group-hover:opacity-100">
              <div className="whitespace-nowrap rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-lg border border-slate-700">
                {item.label}
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function DashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function MonitorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function OrdersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function KittingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 5h5l3 5" />
      <path d="M3 19h5l3-5" />
      <path d="M3 12h8" />
      <rect x="11" y="8" width="10" height="8" rx="1" />
      <path d="m14 11 2 2 3-4" />
    </svg>
  );
}

function WeldingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m4 19 7-7" />
      <path d="m9 10 5-5 5 5-5 5z" />
      <path d="M3 21h8" />
      <path d="M18 3v2M22 7h-2M20.5 4.5 19 6" />
    </svg>
  );
}

function QualityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 5h6M9 3h6v4H9z" />
      <path d="M7 5H5v16h14V5h-2" />
      <path d="m8 12 2 2 4-4M8 18h7" />
    </svg>
  );
}

function ConfigIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 5h18v14H3z" />
      <path d="M7 8v8M10 8v8M14 8v8M17 8v8" />
      <path d="M5 8h14M5 16h14" />
    </svg>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
