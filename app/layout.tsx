import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { SidebarNav } from "@/components/sidebar-nav";
import { sairSistema } from "@/lib/actions/auth";
import { buscarOperadorLogado, destinoInicial, podeAcessarRota } from "@/lib/auth-operador";

export const metadata: Metadata = {
  title: "ENGATES BRUCKE | Sistema de Produção",
  description: "Sistema de execução de manufatura – Torre de Controle do PCP",
  icons: {
    // Mantém o ícone da aba igual à logo apresentada no login.
    icon: "/uploads/logo/logoBrucke.jpg",
    shortcut: "/uploads/logo/logoBrucke.jpg",
    apple: "/uploads/logo/logoBrucke.jpg",
  },
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
          
          {/* Barra lateral: expande ao passar o mouse para revelar os nomes. */}
          <aside className={`${paginaApontamento ? "hidden sm:flex" : "flex"} group/sidebar relative w-16 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-[#1A222C] shadow-xl transition-[width] duration-200 ease-out hover:w-60 z-20 print:hidden`}>
            {/* Top Logo / App Icon */}
            <div className="flex h-14 items-center justify-center bg-[#1A222C] px-1 shadow-md shadow-black/20 transition-all duration-200 group-hover/sidebar:justify-start group-hover/sidebar:px-3">
              <img
                src="/uploads/logo/logoBrucke-transparente.png"
                alt="Engates Brucke"
                className="h-10 w-14 object-contain"
              />
              <div className="ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,margin,opacity] duration-200 group-hover/sidebar:ml-2 group-hover/sidebar:max-w-28 group-hover/sidebar:opacity-100">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300">Engates</p>
                <p className="text-xs font-bold tracking-wide text-slate-100">BRUCKE</p>
              </div>
            </div>
            
            <SidebarNav administrador={usuario.administrador} papel={usuario.papel} setorNome={usuario.setorNome} />
            
            <div className="mt-auto flex h-14 items-center justify-center border-t border-white/5 transition-all duration-200 group-hover/sidebar:justify-start group-hover/sidebar:px-5">
              <div className="group/status relative flex cursor-pointer items-center justify-center">
                 <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                 <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-emerald-400 opacity-0 transition-[max-width,margin,opacity] duration-200 group-hover/sidebar:ml-3 group-hover/sidebar:max-w-32 group-hover/sidebar:opacity-100">
                   Sistema online
                 </span>
                 
                 <div className="pointer-events-none absolute left-8 z-50 hidden items-center opacity-0 transition-opacity group-hover/status:flex group-hover/status:opacity-100 group-hover/sidebar:hidden">
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
                 <div className={`leading-tight ${paginaApontamento ? "hidden sm:block" : ""}`}>
                   <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300">ENGATES BRUCKE</p>
                   <h1 className="text-sm font-semibold tracking-wide text-slate-100">Sistema de Produção</h1>
                 </div>
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
