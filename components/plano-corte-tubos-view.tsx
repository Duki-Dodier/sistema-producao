"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Check, FileCheck2, Search, Square, X } from "lucide-react";
import { emitirPlanoCorteTubos, type ResultadoEmissaoPlanoCorteTubos } from "@/lib/actions/plano-corte-tubos";
import type { OpDisponivelPlanoTubo } from "@/lib/plano-corte-tubos-dados";
import {
  calcularPlanoCorteTubos,
  COMPRIMENTO_BARRA_TUBO_MM,
  type DemandaCorteTubo,
  type PadraoCorteTubo,
} from "@/lib/plano-corte-tubos";

type PlanoHistorico = {
  id: number;
  codigo: string;
  emitidoEm: string;
  criadoPor: string;
  totalOps: number;
  totalBarras: number;
  totalPecas: number;
  aproveitamentoPct: number;
};

const estadoInicial: ResultadoEmissaoPlanoCorteTubos | null = null;
const cores = ["#22d3ee", "#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#fb7185"];

function numero(valor: number, casas = 0) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function milimetros(valor: number) {
  return `${numero(valor, valor % 1 === 0 ? 0 : 1)} mm`;
}

export function PlanoCorteTubosView({
  ops,
  demandas,
  historico,
}: {
  ops: OpDisponivelPlanoTubo[];
  demandas: DemandaCorteTubo[];
  historico: PlanoHistorico[];
}) {
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState("");
  const [perdaCorteMm, setPerdaCorteMm] = useState(3);
  const [refileInicialMm, setRefileInicialMm] = useState(10);
  const [resultadoEmissao, acaoEmitir, emitindo] = useActionState(emitirPlanoCorteTubos, estadoInicial);

  const opsFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleUpperCase("pt-BR");
    if (!termo) return ops;
    return ops.filter((op) => [String(op.numeroSequencia), op.lote, op.modeloCodigo, op.modeloNome ?? ""]
      .some((valor) => valor.toLocaleUpperCase("pt-BR").includes(termo)));
  }, [busca, ops]);

  const demandasSelecionadas = useMemo(
    () => demandas.filter((demanda) => selecionadas.has(demanda.opId)),
    [demandas, selecionadas],
  );

  const calculo = useMemo(() => calcularPlanoCorteTubos(demandasSelecionadas, {
    comprimentoBarraMm: COMPRIMENTO_BARRA_TUBO_MM,
    perdaCorteMm,
    refileInicialMm,
  }), [demandasSelecionadas, perdaCorteMm, refileInicialMm]);

  function alternarOp(op: OpDisponivelPlanoTubo) {
    if (!op.apta) return;
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(op.id)) proximo.delete(op.id);
      else proximo.add(op.id);
      return proximo;
    });
  }

  function selecionarTodas() {
    setSelecionadas(new Set(ops.filter((op) => op.apta).map((op) => op.id)));
  }

  const podeEmitir = selecionadas.size > 0 && calculo.padroes.length > 0 && calculo.erros.length === 0 && !emitindo;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-cyan-400/25 bg-[#111c2e] shadow-xl shadow-black/15">
        <div className="grid gap-4 border-b border-slate-700 p-4 xl:grid-cols-[1fr_340px] xl:items-end">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">1. Selecione as ordens de produção</p>
            <p className="mt-1 text-sm text-slate-400">O cálculo usa somente o saldo ainda não apontado no corte do setor TUBO.</p>
            <div className="relative mt-3 max-w-2xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar OP, lote ou modelo"
                className="w-full rounded-lg border border-slate-600 bg-[#091321] py-2.5 pl-10 pr-3 text-base text-white outline-none transition focus:border-cyan-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={selecionarTodas} className="rounded-lg bg-cyan-400 px-3 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">Selecionar todas aptas</button>
            <button type="button" onClick={() => setSelecionadas(new Set())} className="rounded-lg border border-slate-600 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-400">Limpar seleção</button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-slate-700/70 px-4 py-3 text-sm">
          <span className="font-semibold text-white">{selecionadas.size} OP(s) selecionada(s)</span>
          <span className="text-slate-400">{ops.filter((op) => op.apta).length} apta(s) · {ops.filter((op) => !op.apta).length} bloqueada(s)</span>
        </div>

        <div className="grid max-h-[430px] gap-2 overflow-y-auto p-3 lg:grid-cols-2 2xl:grid-cols-3">
          {opsFiltradas.map((op) => {
            const selecionada = selecionadas.has(op.id);
            return (
              <button
                type="button"
                key={op.id}
                disabled={!op.apta}
                onClick={() => alternarOp(op)}
                className={`rounded-lg border p-3 text-left transition ${op.apta
                  ? selecionada
                    ? "border-cyan-300 bg-cyan-400/12 shadow-[inset_3px_0_0_#22d3ee]"
                    : "border-slate-700 bg-[#162235] hover:border-cyan-400/50"
                  : "cursor-not-allowed border-rose-400/20 bg-rose-400/5 opacity-75"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-white">OP {op.numeroSequencia} <span className="font-normal text-slate-500">· {op.lote}</span></p>
                    <p className="mt-0.5 text-sm text-slate-300">{op.modeloCodigo}{op.modeloNome ? ` · ${op.modeloNome}` : ""}</p>
                  </div>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border ${selecionada ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-600 text-slate-500"}`}>
                    {selecionada ? <Check className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-slate-900/70 px-2 py-1 text-slate-300">OP: {numero(op.quantidade)} conjunto(s)</span>
                  <span className="rounded bg-slate-900/70 px-2 py-1 font-bold text-cyan-200">{numero(op.totalPecasPendentes)} corte(s) pendente(s)</span>
                </div>
                {op.pecas.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-white/5 pt-2 text-xs text-slate-400">
                    {op.pecas.slice(0, 3).map((peca) => (
                      <p key={peca.id} className={peca.apta ? "" : "text-rose-200"}>
                        <b className="text-slate-200">{peca.codigo}</b> · {peca.perfilMm ? `${peca.perfilMm}×${peca.perfilMm}` : "perfil inválido"} · {peca.espessuraMm ? `${numero(peca.espessuraMm, peca.espessuraMm % 1 ? 1 : 0)} mm` : "sem espessura"} · {peca.comprimentoMm ? `${milimetros(peca.comprimentoMm)}` : "sem comprimento"} · {peca.pendente} un.
                      </p>
                    ))}
                    {op.pecas.length > 3 && <p>+ {op.pecas.length - 3} peça(s)</p>}
                  </div>
                )}
                {!op.apta && (
                  <div className="mt-3 rounded border border-rose-300/20 bg-rose-400/10 px-2 py-1.5 text-xs text-rose-100">
                    {op.problemas.slice(0, 3).map((problema) => <p key={problema}>• {problema}</p>)}
                    {op.problemas.length > 3 && <p>• mais {op.problemas.length - 3} correção(ões)</p>}
                  </div>
                )}
              </button>
            );
          })}
          {opsFiltradas.length === 0 && <p className="col-span-full p-8 text-center text-sm text-slate-400">Nenhuma OP encontrada.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-[#111c2e] p-4 shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-amber-300">2. Parâmetros reais da serra</p>
            <p className="mt-1 text-sm text-slate-400">A barra é fixa em 6.000 mm. Ajuste apenas os valores usados no corte.</p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[620px]">
            <DadoFixo rotulo="Barra nova" valor="6.000 mm" />
            <CampoNumero rotulo="Perda por corte" valor={perdaCorteMm} setValor={setPerdaCorteMm} max={20} />
            <CampoNumero rotulo="Refile inicial" valor={refileInicialMm} setValor={setRefileInicialMm} max={200} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">3. Melhor sequência encontrada</p>
          <p className="mt-1 text-sm text-slate-400">Perfis e espessuras diferentes nunca são misturados.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Indicador rotulo="OPs" valor={numero(calculo.indicadores.totalOps)} />
          <Indicador rotulo="Peças" valor={numero(calculo.indicadores.totalPecas)} />
          <Indicador rotulo="Padrões" valor={numero(calculo.indicadores.totalPadroes)} />
          <Indicador rotulo="Barras de 6 m" valor={numero(calculo.indicadores.totalBarras)} destaque />
          <Indicador rotulo="Metros úteis" valor={`${numero(calculo.indicadores.comprimentoPecasMm / 1000, 2)} m`} />
          <Indicador rotulo="Perda da serra" valor={`${numero(calculo.indicadores.perdaCortesTotalMm / 1000, 2)} m`} />
          <Indicador rotulo="Sobra prevista" valor={`${numero(calculo.indicadores.sobraTotalMm / 1000, 2)} m`} />
          <Indicador rotulo="Aproveitamento" valor={`${numero(calculo.indicadores.aproveitamentoPct, 1)}%`} destaque />
        </div>

        {calculo.erros.length > 0 && (
          <div role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
            {calculo.erros.map((erro) => <p key={erro}>{erro}</p>)}
          </div>
        )}

        {calculo.padroes.length > 0 ? (
          <div className="space-y-3">
            {calculo.padroes.map((padrao, indice) => <Padrao key={padrao.codigo} padrao={padrao} indice={indice} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-600 bg-[#111c2e] p-10 text-center">
            <p className="text-base font-semibold text-slate-200">Selecione uma ou mais OPs aptas para calcular.</p>
            <p className="mt-1 text-sm text-slate-500">A simulação acontece sem gravar ou alterar a produção.</p>
          </div>
        )}
      </section>

      <form action={acaoEmitir} className="sticky bottom-3 z-10 rounded-xl border border-cyan-300/30 bg-[#081422]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur">
        {[...selecionadas].map((id) => <input key={id} type="hidden" name="opId" value={id} />)}
        <input type="hidden" name="perdaCorteMm" value={perdaCorteMm} />
        <input type="hidden" name="refileInicialMm" value={refileInicialMm} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-3xl text-sm text-slate-400">
            <b className="text-amber-200">Plano orientativo:</b> emitir não reserva material, não altera OPs e não cria apontamentos.
          </div>
          <button disabled={!podeEmitir} className="inline-flex min-w-52 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500">
            <FileCheck2 className="h-4 w-4" /> {emitindo ? "Emitindo..." : "Emitir plano"}
          </button>
        </div>
        {resultadoEmissao && !resultadoEmissao.ok && <p role="alert" className="mt-2 text-sm text-rose-200">{resultadoEmissao.mensagem}</p>}
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#111c2e]">
        <div className="border-b border-slate-700 px-4 py-3">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-200">Planos já emitidos</h2>
          <p className="mt-1 text-sm text-slate-500">Documentos históricos; nenhum deles interfere na produção.</p>
        </div>
        {historico.length ? historico.map((plano) => (
          <Link key={plano.id} href={`/pcp/plano-corte-tubos/${plano.id}`} className="grid gap-2 border-b border-slate-700/60 px-4 py-3 text-sm transition last:border-0 hover:bg-white/[0.03] sm:grid-cols-[1.5fr_1fr_repeat(4,0.65fr)] sm:items-center">
            <div><b className="text-cyan-200">{plano.codigo}</b><p className="text-xs text-slate-500">{plano.emitidoEm}</p></div>
            <span className="text-slate-300">{plano.criadoPor}</span>
            <span><b className="text-white">{plano.totalOps}</b><small className="ml-1 text-slate-500">OPs</small></span>
            <span><b className="text-white">{plano.totalBarras}</b><small className="ml-1 text-slate-500">barras</small></span>
            <span><b className="text-white">{plano.totalPecas}</b><small className="ml-1 text-slate-500">peças</small></span>
            <span className="font-bold text-emerald-300">{numero(plano.aproveitamentoPct, 1)}%</span>
          </Link>
        )) : <p className="p-6 text-center text-sm text-slate-500">Nenhum plano emitido.</p>}
      </section>

      {resultadoEmissao?.ok && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="plano-emitido-titulo">
          <div className="w-full max-w-md rounded-2xl border border-emerald-300/40 bg-[#101d2d] p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><FileCheck2 className="h-7 w-7" /></div>
            <h2 id="plano-emitido-titulo" className="mt-4 text-xl font-black uppercase text-white">Plano emitido</h2>
            <p className="mt-2 text-sm text-slate-300">{resultadoEmissao.mensagem}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Link href={`/pcp/plano-corte-tubos/${resultadoEmissao.id}`} className="rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950">Abrir plano</Link>
              <a href={`/pcp/plano-corte-tubos/${resultadoEmissao.id}/pdf`} className="rounded-lg border border-slate-600 px-4 py-3 text-sm font-bold text-white">Baixar PDF</a>
            </div>
            <Link href="/pcp/plano-corte-tubos" className="mt-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><X className="h-4 w-4" /> Fechar</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function CampoNumero({ rotulo, valor, setValor, max }: { rotulo: string; valor: number; setValor: (valor: number) => void; max: number }) {
  return <label className="rounded-lg border border-slate-700 bg-[#091321] p-3"><span className="block text-xs font-semibold text-slate-400">{rotulo}</span><div className="mt-1 flex items-center gap-2"><input type="number" min={0} max={max} step={0.1} value={valor} onChange={(evento) => { const proximo = Number(evento.target.value); setValor(Number.isFinite(proximo) ? proximo : 0); }} className="min-w-0 flex-1 bg-transparent text-lg font-black text-white outline-none" /><span className="text-sm text-slate-500">mm</span></div></label>;
}

function DadoFixo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="rounded-lg border border-slate-700 bg-[#091321] p-3"><span className="block text-xs font-semibold text-slate-400">{rotulo}</span><strong className="mt-1 block text-lg text-white">{valor}</strong></div>;
}

function Indicador({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return <div className={`rounded-xl border p-3 ${destaque ? "border-cyan-300/35 bg-cyan-400/10" : "border-slate-700 bg-[#111c2e]"}`}><p className="text-xs font-semibold text-slate-500">{rotulo}</p><strong className={`mt-1 block text-xl ${destaque ? "text-cyan-200" : "text-white"}`}>{valor}</strong></div>;
}

function Padrao({ padrao, indice }: { padrao: PadraoCorteTubo; indice: number }) {
  const larguraSobra = Math.max(0, (padrao.sobraPorBarraMm / padrao.comprimentoBarraMm) * 100);
  return <article className="overflow-hidden rounded-xl border border-slate-700 bg-[#111c2e]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-[#152338] px-4 py-3">
      <div><p className="font-mono text-xs font-black text-cyan-300">{padrao.codigo} · TUBO {padrao.perfilMm}×{padrao.perfilMm}×{numero(padrao.espessuraMm, padrao.espessuraMm % 1 ? 1 : 0)} MM</p><h3 className="mt-1 text-lg font-black text-white">REPETIR EM {padrao.repeticoes} BARRA(S)</h3></div>
      <div className="text-right"><strong className="text-lg text-emerald-300">{numero(padrao.aproveitamentoPct, 1)}%</strong><p className="text-xs text-slate-500">sobra de {milimetros(padrao.sobraPorBarraMm)} por barra</p></div>
    </header>
    <div className="p-4">
      <div className="flex h-12 overflow-hidden rounded-md border-2 border-slate-500 bg-slate-950" aria-label={`Representação do padrão ${padrao.codigo}`}>
        {padrao.itens.map((item, itemIndice) => <div key={`${item.opId}-${item.pecaId}`} style={{ width: `${(item.quantidadePorBarra * item.comprimentoMm / padrao.comprimentoBarraMm) * 100}%`, backgroundColor: cores[(indice + itemIndice) % cores.length] }} className="flex min-w-5 items-center justify-center border-r border-slate-950/50 px-1 text-center text-xs font-black text-slate-950"><span className="truncate">{item.quantidadePorBarra}× {item.pecaCodigo}</span></div>)}
        {larguraSobra > 0 && <div style={{ width: `${larguraSobra}%` }} className="ml-auto flex items-center justify-center bg-slate-800 px-1 text-xs text-slate-400">SOBRA</div>}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Seq.</th><th className="pb-2">OP / lote</th><th className="pb-2">Modelo</th><th className="pb-2">Peça</th><th className="pb-2 text-right">Comprimento</th><th className="pb-2 text-right">Por barra</th><th className="pb-2 text-right">Total</th></tr></thead>
          <tbody>{padrao.itens.map((item, itemIndice) => <tr key={`${item.opId}-${item.pecaId}`} className="border-t border-slate-700/70"><td className="py-2 font-mono text-cyan-300">{itemIndice + 1}</td><td className="py-2 text-white">OP {item.opNumero} · {item.lote}</td><td className="py-2 text-slate-300">{item.modeloCodigo}</td><td className="py-2"><b className="text-white">{item.pecaCodigo}</b><span className="ml-2 text-slate-500">{item.pecaNome}</span></td><td className="py-2 text-right text-slate-300">{milimetros(item.comprimentoMm)}</td><td className="py-2 text-right font-bold text-amber-200">{item.quantidadePorBarra}</td><td className="py-2 text-right font-bold text-emerald-300">{item.quantidadeTotal}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  </article>;
}
