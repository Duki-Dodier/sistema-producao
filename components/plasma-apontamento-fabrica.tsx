import Link from "next/link";

type StatusNest = "PROGRAMADO" | "EM_CORTE" | "PAUSADO";

export type NestApontamentoFabrica = {
  id: number;
  codigo: string;
  status: StatusNest;
  maquina: { codigo: string; nome: string };
  itens: {
    quantidadePlanejada: number;
    op: { numeroSequencia: number; lote: string | null };
    lancamentos: { quantidadeBoa: number; quantidadeRefugo: number }[];
  }[];
};

const statusConfig: Record<StatusNest, { label: string; className: string; ponto: string }> = {
  EM_CORTE: { label: "Em corte", className: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100", ponto: "bg-emerald-300" },
  PAUSADO: { label: "Pausado", className: "border-amber-300/35 bg-amber-300/10 text-amber-100", ponto: "bg-amber-300" },
  PROGRAMADO: { label: "Programado", className: "border-sky-300/35 bg-sky-300/10 text-sky-100", ponto: "bg-sky-300" },
};

const prioridadeStatus: Record<StatusNest, number> = { EM_CORTE: 0, PAUSADO: 1, PROGRAMADO: 2 };

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

export function PlasmaApontamentoFabrica({ nests }: { nests: NestApontamentoFabrica[] }) {
  const nestsOrdenados = [...nests].sort((a, b) => prioridadeStatus[a.status] - prioridadeStatus[b.status]);

  return (
    <section className="rounded-xl border border-cyan-400/25 bg-[#202a36] shadow-lg shadow-black/10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/15 px-4 py-4 sm:px-5">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Apontamento do Plasma Chapa</p>
          <h2 className="mt-1 text-lg font-bold text-white">Escolha um NEST para operar</h2>
          <p className="mt-1 text-sm text-slate-400">Esta lista substitui a leitura do QR Code no computador e abre a mesma tela usada pelo celular.</p>
        </div>
        <span className="rounded border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-100">{nests.length} NEST(s) ativos</span>
      </header>

      {nestsOrdenados.length > 0 ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {nestsOrdenados.map((nest) => {
            const status = statusConfig[nest.status];
            const planejado = nest.itens.reduce((soma, item) => soma + item.quantidadePlanejada, 0);
            const declarado = nest.itens.flatMap((item) => item.lancamentos).reduce((soma, lancamento) => soma + lancamento.quantidadeBoa + lancamento.quantidadeRefugo, 0);
            const ops = [...new Map(nest.itens.map((item) => [item.op.numeroSequencia, item.op])).values()];
            const resumoOps = ops.map((op) => `OP ${op.numeroSequencia}${op.lote ? ` · lote ${op.lote}` : " · sem lote"}`).join(" | ");
            const percentual = planejado > 0 ? Math.min(100, Math.round((declarado / planejado) * 100)) : 0;

            return (
              <article key={nest.id} className={`flex min-w-0 flex-col rounded-xl border bg-[#111925]/75 p-4 ${status.className.split(" ").filter((item) => item.startsWith("border-")).join(" ")}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">NEST</p>
                    <h3 className="mt-1 truncate font-mono text-xl font-black text-cyan-100">{nest.codigo}</h3>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${status.className}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.ponto}`} />
                    {status.label}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-200">{nest.maquina.nome}</p>
                <p className="mt-0.5 text-xs text-slate-500">Máquina {nest.maquina.codigo}</p>
                <p className="mt-3 min-h-10 text-xs leading-5 text-slate-400">{resumoOps || "Nenhuma OP vinculada"}</p>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Resumo rotulo="Planejado" valor={planejado} />
                  <Resumo rotulo="Registrado" valor={declarado} cor="text-sky-200" />
                  <Resumo rotulo="Pendente" valor={Math.max(0, planejado - declarado)} cor="text-amber-200" />
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-label={`${percentual}% registrado`}>
                  <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${percentual}%` }} />
                </div>
                <Link href={`/plasma/operar/${nest.id}`} className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-cyan-400 px-4 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-950 transition hover:bg-cyan-300">
                  Abrir apontamento
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="px-4 py-12 text-center text-sm text-slate-500">Nenhum NEST do Plasma Chapa está programado, em corte ou pausado no momento.</p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/80 px-4 py-3 sm:px-5">
        <p className="text-xs text-slate-500">Quando estiver com o celular, o mesmo fluxo pode ser aberto pelo QR Code.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/apontamentos/scanner?destino=plasma" className="rounded border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/10">Abrir scanner</Link>
          <Link href="/plasma" className="rounded border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Ver painel Plasma</Link>
        </div>
      </footer>
    </section>
  );
}

function Resumo({ rotulo, valor, cor = "text-white" }: { rotulo: string; valor: number; cor?: string }) {
  return <div className="rounded-lg border border-slate-700 bg-slate-950/25 px-2 py-2"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{rotulo}</p><p className={`mt-1 text-base font-black ${cor}`}>{numero(valor)}</p></div>;
}
