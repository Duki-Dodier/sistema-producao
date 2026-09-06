import type { ConferenciaPlasmaFabrica } from "@/lib/plasma-conferencia-fabrica";
import { PlasmaConferenciaOPForm } from "@/components/plasma-conferencia-op-form";

const statusNest: Record<string, { label: string; className: string }> = {
  PROGRAMADO: { label: "Programado", className: "border-sky-300/25 bg-sky-300/10 text-sky-100" },
  EM_CORTE: { label: "Em corte", className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" },
  PAUSADO: { label: "Pausado", className: "border-amber-300/25 bg-amber-300/10 text-amber-100" },
  CONCLUIDO: { label: "Concluído", className: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100" },
  CANCELADO: { label: "Cancelado", className: "border-slate-500/30 bg-slate-500/10 text-slate-300" },
};

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

function dataHora(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
}

export function PlasmaConferenciaApontamentoFabrica({
  dados,
}: {
  dados: ConferenciaPlasmaFabrica | null;
}) {
  if (!dados) {
    return (
      <section className="rounded-xl border border-amber-400/25 bg-[#202a36] p-5 shadow-lg shadow-black/10">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">Apontamento do conferente · Plasma Chapa</p>
        <h2 className="mt-1 text-lg font-bold text-amber-100">Abra uma OP do Plasma Chapa</h2>
        <p className="mt-2 text-sm text-slate-400">Use o link ao lado do QR Code da OP ou leia o QR Code para carregar a peça, o lote e os lançamentos do corte.</p>
      </section>
    );
  }

  const prontoParaConferir = dados.todosNestsFinalizados && dados.pendentes > 0;
  const possuiLancamentos = dados.itens.some((item) => item.lancamentos.length > 0);

  return (
    <section className="rounded-xl border border-amber-400/25 bg-[#202a36] shadow-lg shadow-black/10">
      <header className="border-b border-amber-400/15 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">Apontamento do conferente · Plasma Chapa</p>
            <h2 className="mt-1 text-xl font-bold text-white">OP {dados.numeroSequencia}</h2>
            <p className="mt-1 text-sm text-slate-300">{dados.pecaCodigo} · {dados.pecaNome} · {dados.modeloCodigo}{dados.modeloNome ? ` · ${dados.modeloNome}` : ""}</p>
            <p className="mt-1 text-xs text-slate-500">Lote: <strong className="text-slate-300">{dados.lote ?? "Sem lote"}</strong> · Conferência final do corte</p>
          </div>
          <span className="rounded border border-amber-300/35 bg-amber-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-100">
            {dados.pendentes > 0 ? "Aguardando conferência" : possuiLancamentos ? "Conferida" : "Aguardando lançamento"}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5 sm:px-5">
        <Resumo titulo="Total da OP" valor={dados.necessaria} cor="text-white" />
        <Resumo titulo="Planejado nos NESTs" valor={dados.totalPlanejado} />
        <Resumo titulo="Declarado operador" valor={dados.totalDeclarado} cor="text-sky-200" />
        <Resumo titulo="Já liberado" valor={dados.totalLiberado} cor="text-emerald-200" />
        <Resumo titulo="Lançamentos pendentes" valor={dados.pendentes} cor="text-amber-200" />
      </div>

      <div className="border-t border-slate-700/80 px-4 py-4 sm:px-5">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Rastreabilidade do corte</p>
          <h3 className="mt-1 text-lg font-bold text-white">NESTs e lançamentos da OP</h3>
          <p className="mt-1 text-sm text-slate-400">Confira o total recebido da OP. Esta tela não inicia corte e não controla tempo.</p>
        </div>

        <div className="mt-4 space-y-3">
          {dados.itens.map((item) => {
            const status = statusNest[item.nestStatus] ?? { label: item.nestStatus, className: "border-slate-500/30 bg-slate-500/10 text-slate-300" };
            return (
              <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/25 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-cyan-100">{item.nestCodigo}</p>
                    <p className="mt-1 text-xs text-slate-400">Máquina {item.maquinaCodigo} · {item.maquinaNome} · {numero(item.quantidadePlanejada)} planejadas</p>
                  </div>
                  <span className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${status.className}`}>{status.label}</span>
                </div>

                {item.lancamentos.length ? item.lancamentos.map((lancamento) => {
                  const confirmado = lancamento.apontamentoId !== null;
                  const boas = confirmado ? lancamento.quantidadeConferidaBoa ?? lancamento.quantidadeBoa : lancamento.quantidadeBoa;
                  const perdas = confirmado ? lancamento.quantidadeConferidaRefugo ?? lancamento.quantidadeRefugo : lancamento.quantidadeRefugo;
                  return (
                    <div key={lancamento.id} className={`mt-3 rounded-xl border p-3 ${confirmado ? "border-emerald-400/25 bg-emerald-400/5" : "border-amber-400/25 bg-amber-400/5"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{lancamento.operadorNome}</p>
                          <p className="mt-1 text-xs text-slate-500">Lançado em {dataHora(lancamento.dataHora)}</p>
                        </div>
                        <div className="text-right text-sm"><strong className="text-sky-200">{numero(boas)}</strong> boas · <strong className="text-rose-200">{numero(perdas)}</strong> perdas</div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
                        {confirmado ? (
                          <span className="font-bold uppercase tracking-wide text-emerald-200">Liberado por {lancamento.conferenteNome ?? "conferente"}{lancamento.conferidoEm ? ` · ${dataHora(lancamento.conferidoEm)}` : ""}</span>
                        ) : (
                          <span className="font-bold uppercase tracking-wide text-amber-200">Pendente de conferência</span>
                        )}
                        {lancamento.motivoConferencia && <span className="text-slate-500">Motivo: {lancamento.motivoConferencia}</span>}
                      </div>
                    </div>
                  );
                }) : <p className="mt-3 rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">Nenhum lançamento do operador neste NEST.</p>}
              </article>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-700/80 p-4 sm:px-5">
        {prontoParaConferir ? (
          <PlasmaConferenciaOPForm
            opId={dados.opId}
            pecaId={dados.pecaId}
            necessaria={dados.necessaria}
            totalLiberado={dados.totalLiberado}
            totalDeclarado={dados.totalDeclarado}
            totalPerdasDeclaradas={dados.totalPerdasDeclaradas}
          />
        ) : !possuiLancamentos ? (
          <p className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-amber-100">Ainda não há lançamento de corte do operador para esta OP/peça. A conferência será liberada depois que o operador finalizar o NEST.</p>
        ) : dados.pendentes === 0 ? (
          <p className="rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-4 text-sm text-emerald-100">Todos os lançamentos desta OP/peça já foram conferidos e liberados para a fábrica.</p>
        ) : (
          <p className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-amber-100">A conferência será liberada depois que todos os NESTs desta OP/peça forem encerrados pelo operador.</p>
        )}
      </div>
    </section>
  );
}

function Resumo({ titulo, valor, cor = "text-slate-100" }: { titulo: string; valor: number; cor?: string }) {
  return <div className="rounded-lg border border-slate-700 bg-slate-950/25 px-3 py-2.5"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-1 text-lg font-bold ${cor}`}>{numero(valor)}</p></div>;
}
