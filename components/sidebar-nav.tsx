"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Painel Geral", icon: DashboardIcon },
  { href: "/monitoramento", label: "Monitoramento (Produção Geral)", icon: MonitorIcon },
  { href: "/plasma", label: "Plasma", icon: PlasmaIcon },
  { href: "/ponteiras", label: "Ponteiras Macho", icon: PonteiraIcon },
  { href: "/relatorios", label: "Relatórios e Capacidade", icon: ReportsIcon },
  { href: "/ops", label: "Ordens de Produção", icon: OrdersIcon },
  { href: "/agrupamento", label: "Agrupamento (WIP)", icon: KittingIcon },
  { href: "/solda", label: "Soldagem", icon: WeldingIcon },
  { href: "/apontamentos", label: "Apontamentos da Fábrica", icon: QualityIcon },
  { href: "/modelos", label: "Engenharia de Produto", icon: ConfigIcon },
  { href: "/pecas", label: "Peças e BOM", icon: PartsIcon },
  { href: "/historico", label: "Histórico de alterações", icon: HistoryIcon },
  { href: "/configuracoes", label: "Configurações (Funcionários, Metas)", icon: SettingsIcon },
];

export function SidebarNav({
  administrador,
  papel,
  setorNome,
}: {
  administrador: boolean;
  papel: string;
  setorNome: string;
}) {
  const pathname = usePathname();
  const operadorDoPlasma = /PLASMA/i.test(setorNome);
  const itensVisiveis = administrador
    ? NAV_ITEMS
    : papel === "OPERADOR"
      ? NAV_ITEMS.filter((item) =>
          item.href === "/apontamentos" || (operadorDoPlasma && item.href === "/plasma"),
      )
      : papel === "LIDER"
        ? NAV_ITEMS.filter((item) =>
            ["/", "/monitoramento", "/plasma", "/ponteiras", "/relatorios", "/agrupamento", "/solda", "/apontamentos"].includes(item.href),
          )
        : NAV_ITEMS.filter((item) => item.href !== "/configuracoes");

  return (
    <nav className="flex w-full flex-1 flex-col items-center gap-3 px-2 py-4">
      {itensVisiveis.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            className={`group/item relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-500 group-hover/sidebar:w-full group-hover/sidebar:justify-start group-hover/sidebar:px-3 ${
              active
                ? "bg-[#3B82F6] text-white shadow-md shadow-blue-500/20"
                : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />

            <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-left text-xs font-semibold opacity-0 transition-[max-width,margin,opacity] duration-500 group-hover/sidebar:ml-3 group-hover/sidebar:max-w-48 group-hover/sidebar:opacity-100">
              {item.label}
            </span>

            {/* Tooltip enquanto a lateral estiver recolhida. */}
            <div className="pointer-events-none absolute left-14 z-50 hidden items-center opacity-0 transition-opacity group-hover/item:flex group-hover/item:opacity-100 group-hover/sidebar:hidden">
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

function PlasmaIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m13 2-8 11h6l-1 9 9-12h-6z" />
      <path d="M4 4h3M17 5h3M3 19h3" opacity=".65" />
    </svg>
  );
}

function PonteiraIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 19 15 5l4 4L9 19z" />
      <path d="m14 6 4 4" />
      <path d="M4 20h8" />
    </svg>
  );
}

function ReportsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 19V5" />
      <path d="M4 19h17" />
      <rect x="7" y="12" width="3" height="4" rx=".5" />
      <rect x="12" y="9" width="3" height="7" rx=".5" />
      <rect x="17" y="6" width="3" height="10" rx=".5" />
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

function PartsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8M8 13h5M8 17h8" />
    </svg>
  );
}

function HistoryIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" />
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

