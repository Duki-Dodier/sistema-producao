"use client";

import { useState, useMemo } from "react";
import type { ItemDemandaTubo, ResultadoOtimizacaoTubo } from "@/lib/otimizador-corte-tubo";
import { otimizarCorteTubos } from "@/lib/otimizador-corte-tubo";
import type { OpDisponivelTubo } from "@/lib/demanda-tubos-ops";
import {
  FileDown,
  Printer,
  Scissors,
  Layers,
  Filter,
  PackageCheck,
  ChevronDown,
  ChevronUp,
  Boxes,
  CheckCircle2,
} from "lucide-react";

const CORES_OP = [
  "bg-blue-600 text-white border-blue-400",
  "bg-emerald-600 text-white border-emerald-400",
  "bg-amber-500 text-slate-950 border-amber-300 font-bold",
  "bg-purple-600 text-white border-purple-400",
  "bg-rose-600 text-white border-rose-400",
  "bg-cyan-600 text-white border-cyan-300",
  "bg-orange-600 text-white border-orange-300",
  "bg-indigo-600 text-white border-indigo-300",
];

export function OtimizadorTuboView({
  demandasIniciais,
  opsDisponiveis,
}: {
  demandasIniciais: ItemDemandaTubo[];
  opsDisponiveis: OpDisponivelTubo[];
}) {
  const [opsSelecionadas, setOpsSelecionadas] = useState<Set<number>>(() => {
    return new Set(opsDisponiveis.filter((o) => o.totalPecasTuboPendentes > 0).map((o) => o.id));
  });

  const [comprimentoBarraMm, setComprimentoBarraMm] = useState<number>(6000);
  const [perdaCorteMm, setPerdaCorteMm] = useState<number>(3);
  const [refileInicialMm, setRefileInicialMm] = useState<number>(10);

  const [perfilAtivo, setPerfilAtivo] = useState<string>("TODOS");
  const [abaAtiva, setAbaAtiva] = useState<"PADROES" | "ROMANEIO">("PADROES");
  const [padroesExpandidos, setPadroesExpandidos] = useState<Set<string>>(new Set());

  const mapaCoresOp = useMemo(() => {
    const mapa = new Map<number, string>();
    opsDisponiveis.forEach((op, idx) => {
      mapa.set(op.numeroSequencia, CORES_OP[idx % CORES_OP.length]);
    });
    return mapa;
  }, [opsDisponiveis]);

  const demandasFiltradas = useMemo(() => {
    return demandasIniciais.filter((d) => opsSelecionadas.has(d.opId));
  }, [demandasIniciais, opsSelecionadas]);

  const resultado: ResultadoOtimizacaoTubo = useMemo(() => {
    return otimizarCorteTubos(demandasFiltradas, {
      comprimentoBarraMm,
      perdaCorteMm,
      refileInicialMm,
    });
  }, [demandasFiltradas, comprimentoBarraMm, perdaCorteMm, refileInicialMm]);

  const perfisDisponiveis = useMemo(() => {
    return resultado.perfis.map((p) => p.perfil);
  }, [resultado.perfis]);

  const perfisExibicao = useMemo(() => {
    if (perfilAtivo === "TODOS") return resultado.perfis;
    return resultado.perfis.filter((p) => p.perfil === perfilAtivo);
  }, [resultado.perfis, perfilAtivo]);

  const toggleOp = (id: number) => {
    setOpsSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const selecionarTodasOps = () => {
    setOpsSelecionadas(new Set(opsDisponiveis.map((o) => o.id)));
  };

  const desmarcarTodasOps = () => {
    setOpsSelecionadas(new Set());
  };

  const toggleExpansaoPadrao = (id: string) => {
    setPadroesExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  // URL para baixar o PDF gerado sob medida
  const urlPdf = useMemo(() => {
    const opsQuery = Array.from(opsSelecionadas).join(",");
    const params = new URLSearchParams({
      ops: opsQuery,
      barra: String(comprimentoBarraMm),
      kerf: String(perdaCorteMm),
      refile: String(refileInicialMm),
    });
    return `/api/relatorios/plano-corte-tubo/pdf?${params.toString()}`;
  }, [opsSelecionadas, comprimentoBarraMm, perdaCorteMm, refileInicialMm]);

  return (
    <div className="space-y-6">
      {/* PAINEL DE CONTROLE E PARÂMETROS */}
      <section className="rounded-2xl border border-white/10 bg-[#111927] p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/20 p-2.5 text-cyan-400">
              <Scissors className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Otimizador e Padrões de Corte de Tubo</h2>
              <p className="text-xs text-slate-400">
                Agrupamento inteligente por padrões de repetição para produção em alta escala
              </p>
            </div>
          </div>

          {/* AÇÕES: BAIXAR PDF PROFISSIONAL OU IMPRIMIR */}
          <div className="flex items-center gap-3">
            <a
              href={urlPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-md hover:bg-cyan-400 active:scale-95 transition-all"
            >
              <FileDown className="h-4 w-4" />
              Baixar PDF Oficial (A4 Paisagem)
            </a>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#172234] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5 active:scale-95 transition-all"
            >
              <Printer className="h-4 w-4" />
              Imprimir Tela
            </button>
          </div>
        </div>

        {/* PARÂMETROS TÉCNICOS */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3 border-b border-white/5 pb-4">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Comprimento da Barra (mm)</span>
            <input
              type="number"
              min={1000}
              max={12000}
              step={100}
              value={comprimentoBarraMm}
              onChange={(e) => setComprimentoBarraMm(Number(e.target.value) || 6000)}
              className="rounded-lg border border-white/10 bg-[#0c121e] px-3 py-2 text-sm font-mono text-white focus:border-cyan-400 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">Padrão da barra nova: 6.000 mm</span>
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Perda por Corte da Serra / Kerf (mm)</span>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={perdaCorteMm}
              onChange={(e) => setPerdaCorteMm(Number(e.target.value) || 0)}
              className="rounded-lg border border-white/10 bg-[#0c121e] px-3 py-2 text-sm font-mono text-white focus:border-cyan-400 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">Espessura do disco/fita (padrão: 3 mm)</span>
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Refile da Ponta Inicial (mm)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={refileInicialMm}
              onChange={(e) => setRefileInicialMm(Number(e.target.value) || 0)}
              className="rounded-lg border border-white/10 bg-[#0c121e] px-3 py-2 text-sm font-mono text-white focus:border-cyan-400 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">Esquadrejamento da barra (padrão: 10 mm)</span>
          </label>
        </div>

        {/* SELEÇÃO DE OPS */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                OPs Selecionadas ({opsSelecionadas.size} de {opsDisponiveis.length})
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={selecionarTodasOps} className="text-cyan-400 hover:underline font-semibold">
                Selecionar Todas
              </button>
              <span className="text-slate-600">·</span>
              <button onClick={desmarcarTodasOps} className="text-slate-400 hover:underline font-semibold">
                Limpar Todas
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
            {opsDisponiveis.map((op) => {
              const selecionada = opsSelecionadas.has(op.id);
              return (
                <button
                  key={op.id}
                  onClick={() => toggleOp(op.id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-xs font-mono transition-all ${
                    selecionada
                      ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                      : "border-white/5 bg-[#0a0f18] text-slate-500 hover:border-white/20 hover:text-slate-300"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${selecionada ? "bg-cyan-400" : "bg-slate-600"}`} />
                  <strong>OP #{op.numeroSequencia}</strong>
                  <span className="text-[11px] opacity-80">({op.modeloCodigo})</span>
                  {op.totalPecasTuboPendentes > 0 ? (
                    <span className="rounded bg-cyan-400/20 px-1 py-0.2 text-[10px] font-bold text-cyan-300">
                      {op.totalPecasTuboPendentes} tubos
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-50">Sem tubos</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* DASHBOARD SÍNTESE DE PRODUÇÃO */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-white/10 bg-[#111927] p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Barras 6m</p>
          <p className="mt-1 text-2xl font-black text-white">{resultado.resumoGeral.totalBarras6m}</p>
          <p className="text-[11px] text-slate-500">{(resultado.resumoGeral.totalBarras6m * 6).toFixed(0)} metros de aço</p>
        </div>

        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">Padrões de Corte</p>
          <p className="mt-1 text-2xl font-black text-cyan-300">{resultado.resumoGeral.totalPadroesCorte}</p>
          <p className="text-[11px] text-cyan-200/70">Receitas para regular a serra</p>
        </div>

        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">Aproveitamento Médio</p>
          <p className="mt-1 text-2xl font-black text-emerald-300">{resultado.resumoGeral.aproveitamentoMedioPct}%</p>
          <p className="text-[11px] text-emerald-200/70">Eficiência global</p>
        </div>

        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">Perda Total (Retalho)</p>
          <p className="mt-1 text-2xl font-black text-amber-300">{resultado.resumoGeral.metrosPerdaTotal} m</p>
          <p className="text-[11px] text-amber-200/70">Sobras somadas</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111927] p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Peças Programadas</p>
          <p className="mt-1 text-2xl font-black text-white">{resultado.resumoGeral.totalPecas}</p>
          <p className="text-[11px] text-slate-500">Tubos a cortar</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111927] p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">OPs Atendidas</p>
          <p className="mt-1 text-2xl font-black text-white">{resultado.resumoGeral.totalOpsAtendidas}</p>
          <p className="text-[11px] text-slate-500">{resultado.resumoGeral.totalPerfis} perfis</p>
        </div>
      </section>

      {/* SELETOR DE MODO DE VISUALIZAÇÃO: PADRÕES vs ROMANEIO */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        {/* Abas */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAbaAtiva("PADROES")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              abaAtiva === "PADROES"
                ? "bg-cyan-500 text-slate-950 shadow-md"
                : "bg-[#111927] text-slate-400 hover:text-white border border-white/10"
            }`}
          >
            <Scissors className="h-4 w-4" />
            Padrões de Corte ({resultado.resumoGeral.totalPadroesCorte})
          </button>

          <button
            onClick={() => setAbaAtiva("ROMANEIO")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              abaAtiva === "ROMANEIO"
                ? "bg-cyan-500 text-slate-950 shadow-md"
                : "bg-[#111927] text-slate-400 hover:text-white border border-white/10"
            }`}
          >
            <Boxes className="h-4 w-4" />
            Romaneio de Caixas por OP
          </button>
        </div>

        {/* Filtro por Perfil */}
        {perfisDisponiveis.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Perfil:</span>
            <select
              value={perfilAtivo}
              onChange={(e) => setPerfilAtivo(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#111927] px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="TODOS">Todos os Perfis ({resultado.perfis.length})</option>
              {perfisDisponiveis.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* CONTEÚDO PRINCIPAL: MODO PADRÕES DE CORTE */}
      {abaAtiva === "PADROES" && (
        <div className="space-y-8">
          {perfisExibicao.map((perfil) => (
            <section
              key={perfil.perfil}
              className="rounded-2xl border border-white/10 bg-[#111927] overflow-hidden shadow-lg"
            >
              {/* Cabeçalho do Perfil */}
              <div className="bg-[#152033] border-b border-white/10 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400">
                    PERFIL DE CORTE
                  </span>
                  <h3 className="text-base font-black text-white">{perfil.perfil}</h3>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="rounded-lg bg-black/40 px-3 py-1 text-cyan-300 font-bold border border-cyan-500/20">
                    {perfil.totalBarras6m} barras de 6m
                  </span>
                  <span className="rounded-lg bg-black/40 px-3 py-1 text-slate-300 border border-white/10">
                    {perfil.padroes.length} padrões
                  </span>
                  <span className="rounded-lg bg-emerald-500/20 px-3 py-1 text-emerald-300 font-bold border border-emerald-400/30">
                    {perfil.aproveitamentoMedioPct}% aproveitamento
                  </span>
                </div>
              </div>

              {/* Lista dos Padrões (Compactos, não barra por barra!) */}
              <div className="p-5 space-y-6">
                {perfil.padroes.map((padrao) => {
                  const expandido = padroesExpandidos.has(padrao.idPadrao);

                  return (
                    <article
                      key={padrao.idPadrao}
                      className="rounded-xl border border-white/10 bg-[#0c1322] p-4 shadow-sm hover:border-white/20 transition-all"
                    >
                      {/* Topo do Padrão */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="rounded-lg bg-cyan-500 px-2.5 py-1 text-xs font-black text-slate-950 font-mono">
                            {padrao.idPadrao}
                          </span>
                          <h4 className="text-sm font-black text-white font-mono">
                            REPETIR EM {padrao.quantidadeBarras} BARRAS DE 6 METROS
                          </h4>
                          <span className="text-xs text-slate-400">
                            (Barras #{padrao.numerosBarras[0]} a #{padrao.numerosBarras[padrao.numerosBarras.length - 1]})
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Destaque Claro da Sobra */}
                          <div
                            className={`rounded-lg px-3 py-1 text-xs font-mono font-bold border ${
                              padrao.sobraMm <= 100
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                                : padrao.sobraMm <= 300
                                ? "bg-amber-500/20 text-amber-300 border-amber-400/30"
                                : "bg-rose-500/20 text-rose-300 border-rose-400/30"
                            }`}
                          >
                            SOBRA POR BARRA: {padrao.sobraCm} cm ({padrao.sobraMm} mm)
                          </div>

                          <span className="text-xs font-mono font-bold text-cyan-300">
                            {padrao.aproveitamentoPct}% aproveitamento
                          </span>
                        </div>
                      </div>

                      {/* FITA GRÁFICA REPRESENTANDO A RECEITA DO PADRÃO */}
                      <div className="relative mb-3 flex h-9 w-full overflow-hidden rounded-lg border border-white/20 bg-slate-900 shadow-inner">
                        {padrao.itens.map((item, idx) => {
                          const larguraPct =
                            ((item.comprimentoMm * item.quantidadePorBarra) / padrao.comprimentoBarraMm) * 100;
                          const cor = mapaCoresOp.get(item.opNumero) ?? CORES_OP[0];

                          return (
                            <div
                              key={idx}
                              style={{ width: `${larguraPct}%` }}
                              className={`relative flex h-full items-center justify-center border-r border-slate-950 px-1 text-center transition-all ${cor}`}
                              title={`${item.quantidadePorBarra}× OP #${item.opNumero} (${item.comprimentoMm} mm)`}
                            >
                              <span className="truncate font-mono text-[10px] font-bold tracking-tight">
                                {item.quantidadePorBarra}× OP {item.opNumero} · {item.comprimentoMm}mm
                              </span>
                            </div>
                          );
                        })}

                        {/* Sobra da Barra */}
                        {padrao.sobraMm > 0 && (
                          <div
                            style={{
                              width: `${(padrao.sobraMm / padrao.comprimentoBarraMm) * 100}%`,
                            }}
                            className="flex h-full items-center justify-center bg-stripes bg-slate-800/90 px-1 text-center"
                            title={`Sobra por barra: ${padrao.sobraCm} cm`}
                          >
                            <span className="truncate font-mono text-[9px] font-bold text-slate-400">
                              {padrao.sobraCm}cm sobra
                            </span>
                          </div>
                        )}
                      </div>

                      {/* TABELA DE CORTES DO PADRÃO (Para regular os batentes da serra) */}
                      <div className="overflow-x-auto rounded-lg border border-white/5 bg-black/25">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase text-slate-400">
                            <tr>
                              <th className="px-3 py-2">OP / Lote</th>
                              <th className="px-3 py-2">Modelo</th>
                              <th className="px-3 py-2">Código da Peça</th>
                              <th className="px-3 py-2">Comprimento</th>
                              <th className="px-3 py-2 text-center text-cyan-300">Nesta Barra</th>
                              <th className="px-3 py-2 text-center text-emerald-300">
                                Total ({padrao.quantidadeBarras} barras)
                              </th>
                              <th className="px-3 py-2 text-right">Destino / Caixa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {padrao.itens.map((item, idx) => (
                              <tr key={idx} className="hover:bg-white/5">
                                <td className="px-3 py-2 font-bold text-white">
                                  OP #{item.opNumero}
                                  <span className="ml-1 text-[10px] font-normal text-slate-400">({item.lote})</span>
                                </td>
                                <td className="px-3 py-2 text-slate-300">{item.modeloCodigo}</td>
                                <td className="px-3 py-2 text-cyan-300 font-bold">{item.pecaCodigo}</td>
                                <td className="px-3 py-2 font-black text-white">{item.comprimentoMm} mm</td>
                                <td className="px-3 py-2 text-center font-bold text-cyan-300">
                                  {item.quantidadePorBarra} peça(s)
                                </td>
                                <td className="px-3 py-2 text-center font-black text-emerald-300">
                                  {item.quantidadeTotal} peças
                                </td>
                                <td className="px-3 py-2 text-right font-sans">
                                  <span className="inline-block rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                                    Caixa OP #{item.opNumero}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* RODAPÉ DO PADRÃO */}
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          Sobra total acumulada neste padrão:{" "}
                          <strong className="text-amber-300">{(padrao.sobraTotalLoteMm / 1000).toFixed(2)} m</strong>{" "}
                          em {padrao.quantidadeBarras} barras
                        </span>

                        <button
                          onClick={() => toggleExpansaoPadrao(padrao.idPadrao)}
                          className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-semibold"
                        >
                          {expandido ? (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" /> Ocultar barras numeradas
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" /> Ver barras numeradas (
                              {padrao.numerosBarras.length})
                            </>
                          )}
                        </button>
                      </div>

                      {/* LISTA COMPACTA DAS BARRAS NUMERADAS (CASO O OPERADOR QUEIRA CONFERIR UMA A UMA) */}
                      {expandido && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-xs font-bold text-slate-300 mb-2">
                            Barras individuais numeradas deste padrão:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {padrao.numerosBarras.map((nBarra) => (
                              <span
                                key={nBarra}
                                className="inline-flex items-center gap-1 rounded bg-slate-900 border border-white/10 px-2.5 py-1 text-xs font-mono text-slate-300"
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                Barra #{String(nBarra).padStart(2, "0")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* CONTEÚDO SECUNDÁRIO: MODO ROMANEIO DE CAIXAS POR OP */}
      {abaAtiva === "ROMANEIO" && (
        <div className="space-y-6">
          {perfisExibicao.map((perfil) => (
            <section
              key={perfil.perfil}
              className="rounded-2xl border border-white/10 bg-[#111927] overflow-hidden shadow-lg"
            >
              <div className="bg-[#152033] border-b border-white/10 px-5 py-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400">
                  ROMANEIO DE PRODUÇÃO E SEPARAÇÃO
                </span>
                <h3 className="text-base font-black text-white">{perfil.perfil}</h3>
              </div>

              <div className="p-5 overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5">OP / Lote</th>
                      <th className="px-4 py-2.5">Modelo</th>
                      <th className="px-4 py-2.5">Código da Peça</th>
                      <th className="px-4 py-2.5">Descrição</th>
                      <th className="px-4 py-2.5 text-right">Comprimento</th>
                      <th className="px-4 py-2.5 text-right text-emerald-300 font-bold">Total Cortado</th>
                      <th className="px-4 py-2.5 text-center">Caixa de Destino</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {perfil.romaneioOps.map((ro, idx) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="px-4 py-2.5 font-bold text-white">
                          OP #{ro.opNumero}
                          <span className="ml-1 text-[10px] font-normal text-slate-400">({ro.lote})</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">{ro.modeloCodigo}</td>
                        <td className="px-4 py-2.5 text-cyan-300 font-bold">{ro.pecaCodigo}</td>
                        <td className="px-4 py-2.5 text-slate-300 font-sans">{ro.pecaNome}</td>
                        <td className="px-4 py-2.5 text-right font-black text-white">{ro.comprimentoMm} mm</td>
                        <td className="px-4 py-2.5 text-right font-black text-emerald-300 text-sm">
                          {ro.quantidadeTotal} peças
                        </td>
                        <td className="px-4 py-2.5 text-center font-sans">
                          <span className="inline-block rounded-lg bg-cyan-500/20 border border-cyan-400/40 px-3 py-1 text-xs font-bold text-cyan-300">
                            Caixa OP #{ro.opNumero}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
