import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { SidebarNav } from "@/components/sidebar-nav";
import { sairSistema } from "@/lib/actions/auth";
import { buscarOperadorLogado, destinoInicial, podeAcessarRota } from "@/lib/auth-operador";

export const metadata: Metadata = {
  title: "MES – Fábrica de Engates",
  description: "Sistema de execução de manufatura – Torre de Controle do PCP",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-mes-pathname") ?? "/";
  const paginaApontamento = pathname.startsWith("/apontamentos");

  if (pathname === "/login") {
    return (
      <html lang="pt-BR" className="h-full antialiased">
        <body className="min-h-full bg-[#07101f] text-slate-200">{children}</body>
      </html>
    );
  }

  const usuario = await buscarOperadorLogado();
  if (!usuario) redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  if (!podeAcessarRota(usuario, pathname)) redirect(destinoInicial(usuario));

  return (
    <html
      lang="pt-BR"
      className="h-full print:h-auto antialiased"
    >
      <body className="h-full print:h-auto bg-[#202A36] print:bg-white text-slate-200 print:text-black">
        <div className="flex h-full print:h-auto print:block">
          
          {/* SIDEBAR COLAPSADA */}
          <aside className={`${paginaApontamento ? "hidden sm:flex" : "flex"} w-16 shrink-0 flex-col bg-[#1A222C] border-r border-white/5 shadow-xl z-20 print:hidden`}>
            {/* Top Logo / App Icon */}
            <div className="flex h-14 items-center justify-center bg-[#3B82F6] shadow-md shadow-blue-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 text-white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </div>
            
            <SidebarNav administrador={usuario.administrador} papel={usuario.papel} />
            
            <div className="mt-auto flex h-14 items-center justify-center border-t border-white/5">
              <div className="group relative flex cursor-pointer items-center justify-center">
                 <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                 
                 <div className="pointer-events-none absolute left-8 z-50 flex hidden items-center opacity-0 transition-opacity group-hover:flex group-hover:opacity-100">
                    <div className="whitespace-nowrap rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-emerald-400 shadow-lg border border-slate-700">
                      Sistema Online
                    </div>
                 </div>
              </div>
            </div>
          </aside>

          {/* ÁREA PRINCIPAL */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible print:block">
            
            {/* TOPBAR (HEADER) */}
            <header className="flex h-14 shrink-0 items-center justify-between bg-[#202A36] px-3 shadow-sm shadow-black/20 z-10 border-b border-white/5 sm:px-6 print:hidden">
              <div className="flex items-center gap-4">
                 <h1 className={`text-sm font-semibold tracking-wide text-slate-100 ${paginaApontamento ? "hidden sm:block" : ""}`}>Painel de Manufatura MES</h1>
                 <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-700">v2</span>
              </div>
              
              <div className="flex items-center gap-4">
                 <button className={`text-slate-400 hover:text-white transition-colors ${paginaApontamento ? "hidden sm:block" : ""}`} title="Ajuda">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth={2}><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                 </button>
                 <button className={`relative text-slate-400 hover:text-white transition-colors ${paginaApontamento ? "hidden sm:block" : ""}`} title="Notificações">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth={2}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                    <span className="absolute 0 right-0 top-0 flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                    </span>
                 </button>
                 <div className="hidden text-right sm:block">
                   <div className="text-xs font-semibold text-slate-200">{usuario.nome}</div>
                   <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                     {usuario.administrador ? "Administrador" : `${usuario.papel} · ${usuario.setorNome}`}
                   </div>
                 </div>
                 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-[11px] font-bold text-cyan-300 ring-1 ring-cyan-400/30" title={usuario.nome}>
                    {usuario.nome.charAt(0).toUpperCase()}
                 </div>
                 <form action={sairSistema}>
                   <button type="submit" className="rounded border border-slate-700 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 transition hover:border-slate-500 hover:text-white">
                     Sair
                   </button>
                 </form>
              </div>
            </header>

            {/* CONTEÚDO SCROLLÁVEL */}
            <main className="flex-1 overflow-y-auto print:overflow-visible print:block">
               {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
