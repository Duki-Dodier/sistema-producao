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

const statusConfig: Record<StatusNest, { label: string; className: string }> = {
  EM_CORTE: { label: "Em corte", className: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" },
  PAUSADO: { label: "Pausado", className: "border-amber-300/35 bg-amber-300/10 text-amber-100" },
  PROGRAMADO: { label: "Programado", className: "border-sky-300/35 bg-sky-300/10 text-sky-100" },
};

const prioridadeStatus: Record<StatusNest, number> = { EM_CORTE: 0, PAUSADO: 1, PROGRAMADO: 2 };

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

export function PlasmaApontamentoFabrica({
  nests,
  finalizado = false,
  reposicao = 0,
}: {
  nests: NestApontamentoFabrica[];
  finalizado?: boolean;
  reposicao?: number;
}) {
  const nestsOrdenados = [...nests].sort((a, b) => prioridadeStatus[a.status] - prioridadeStatus[b.status]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">Plasma Chapa</p>
          <h1 className="mt-1 text-2xl font-black text-white">NESTs para operar</h1>
          <p className="mt-1 text-sm text-slate-400">Escolha um NEST ativo ou leia o QR Code para abrir o apontamento.</p>
        </div>
        <Link href="/apontamentos/scanner?destino=plasma" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300">Ler QR Code do NEST</Link>
      </header>

      {finalizado && (
        <p role="status" className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">
          Corte finalizado. {reposicao > 0 ? `${reposicao} peça(s) foram enviadas à reposição.` : "Nenhuma peça ficou pendente."}
        </p>
      )}

      {nestsOrdenados.length ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {nestsOrdenados.map((nest) => {
            const status = statusConfig[nest.status];
            const planejado = nest.itens.reduce((soma, item) => soma + item.quantidadePlanejada, 0);
            const registrado = nest.itens.flatMap((item) => item.lancamentos).reduce((soma, lancamento) => soma + lancamento.quantidadeBoa + lancamento.quantidadeRefugo, 0);
            const ops = [...new Map(nest.itens.map((item) => [item.op.numeroSequencia, item.op])).values()];

            return (
              <article key={nest.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-700 bg-[#202a36] p-4 shadow-lg shadow-black/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">NEST</p><h2 className="mt-1 truncate font-mono text-xl font-black text-cyan-100">{nest.codigo}</h2></div>
                  <span className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${status.className}`}>{status.label}</span>
                </div>
                <p className="mt-4 text-sm font-bold text-slate-100">{nest.maquina.nome}</p>
                <p className="mt-1 text-xs text-slate-500">Máquina {nest.maquina.codigo}</p>
                <p className="mt-4 min-h-10 text-sm leading-5 text-slate-300">{ops.map((op) => `OP ${op.numeroSequencia} · lote ${op.lote ?? "—"}`).join(" | ")}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Resumo rotulo="Programado" valor={planejado} />
                  <Resumo rotulo="Quantidade" valor={registrado} cor="text-cyan-100" />
                </div>
                <Link href={`/plasma/operar/${nest.id}`} className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300">Abrir apontamento</Link>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-700 bg-[#202a36] px-6 py-14 text-center"><p className="text-lg font-black text-slate-200">Nenhum NEST ativo agora</p><p className="mt-2 text-sm text-slate-500">Assim que uma programação for criada, ela aparecerá nesta lista.</p></section>
      )}
    </main>
  );
}

function Resumo({ rotulo, valor, cor = "text-white" }: { rotulo: string; valor: number; cor?: string }) {
  return <div className="rounded-xl border border-slate-700 bg-slate-950/25 px-3 py-3"><p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{rotulo}</p><p className={`mt-1 text-xl font-black ${cor}`}>{numero(valor)}</p></div>;
}
