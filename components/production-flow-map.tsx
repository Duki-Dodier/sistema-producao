"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

export type FlowDemand = {
  setorId: number;
  setorNome: string;
  necessaria: number;
  pronta: number;
  pecas: { codigo: string; nome: string; necessaria: number; pronta: number }[];
};

export type FlowOP = {
  id: number;
  sequencia: number;
  codigo: string;
  nome: string | null;
  quantidade: number;
  kits: number;
  demandas: FlowDemand[];
};

export type FlowSector = {
  id: number;
  nome: string;
  ops: number;
  necessaria: number;
  pronta: number;
  processos: { nome: string; quantidade: number; necessaria: number }[];
};

export type FlowFinal = {
  nome: string;
  ops: number;
  quantidade: number;
  necessaria: number;
};

type Edge = {
  id: string;
  from: string;
  to: string;
  quantidade: number;
  cor: string;
  tipo: "op" | "convergencia" | "final";
};

type PointEdge = Edge & {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const OP_COLORS = ["#22d3ee", "#38bdf8", "#818cf8", "#a78bfa", "#c084fc", "#2dd4bf"];

export function ProductionFlowMap({
  ops,
  setores,
  linhaFinal,
  opInicial,
  compact = false,
}: {
  ops: FlowOP[];
  setores: FlowSector[];
  linhaFinal: FlowFinal[];
  opInicial?: number | null;
  compact?: boolean;
}) {
  const [opSelecionada, setOpSelecionada] = useState<number | null>(
    opInicial ?? (compact ? ops[0]?.id ?? null : null),
  );
  const [busca, setBusca] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [positions, setPositions] = useState<PointEdge[]>([]);

  const opsVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return ops;
    return ops.filter((op) => `${op.sequencia} ${op.codigo} ${op.nome ?? ""}`.toLowerCase().includes(termo));
  }, [busca, ops]);

  const opsNoFluxo = useMemo(
    () => opSelecionada ? ops.filter((op) => op.id === opSelecionada) : opsVisiveis,
    [opSelecionada, ops, opsVisiveis],
  );
  const maxVolume = Math.max(
    1,
    ...opsNoFluxo.flatMap((op) => op.demandas.map((demanda) => demanda.necessaria)),
    ...setores.map((setor) => setor.pronta),
  );
  const setoresVisiveis = useMemo(() => {
    if (!compact) return setores;
    const ids = new Set(opsNoFluxo.flatMap((op) => op.demandas.map((demanda) => demanda.setorId)));
    return setores.filter((setor) => ids.has(setor.id));
  }, [compact, opsNoFluxo, setores]);

  const edges = useMemo<Edge[]>(() => {
    const linhasOP = compact ? [] : opsNoFluxo.flatMap((op, opIndex) =>
      op.demandas.map((demanda) => ({
        id: `op-${op.id}-setor-${demanda.setorId}`,
        from: `op-${op.id}`,
        to: `setor-${demanda.setorId}`,
        quantidade: demanda.necessaria,
        cor: OP_COLORS[opIndex % OP_COLORS.length],
        tipo: "op" as const,
      })),
    );
    const setoresAtivos = new Set(opsNoFluxo.flatMap((op) => op.demandas.map((demanda) => demanda.setorId)));
    const convergencia = setoresVisiveis
      .filter((setor) => setoresAtivos.has(setor.id))
      .map((setor) => ({
        id: `setor-${setor.id}-agrupamento`,
        from: `setor-${setor.id}`,
        to: "final-agrupamento",
        quantidade: opSelecionada
          ? opsNoFluxo.flatMap((op) => op.demandas).filter((demanda) => demanda.setorId === setor.id).reduce((soma, demanda) => soma + demanda.pronta, 0)
          : setor.pronta,
        cor: "#fbbf24",
        tipo: "convergencia" as const,
      }));
    const finais = linhaFinal.slice(0, -1).map((etapa, index) => ({
      id: `final-${etapa.nome}-${linhaFinal[index + 1]?.nome}`,
      from: `final-${slug(etapa.nome)}`,
      to: `final-${slug(linhaFinal[index + 1]?.nome ?? "")}`,
      quantidade: etapa.quantidade,
      cor: "#38bdf8",
      tipo: "final" as const,
    }));
    return [...linhasOP, ...convergencia, ...finais];
  }, [compact, linhaFinal, opSelecionada, opsNoFluxo, setoresVisiveis]);

  const registerNode = useCallback((key: string) => (element: HTMLElement | null) => {
    if (element) nodeRefs.current.set(key, element);
    else nodeRefs.current.delete(key);
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const base = container.getBoundingClientRect();
      const novas = edges.flatMap((edge) => {
        const origem = nodeRefs.current.get(edge.from);
        const destino = nodeRefs.current.get(edge.to);
        if (!origem || !destino) return [];
        const a = origem.getBoundingClientRect();
        const b = destino.getBoundingClientRect();
        const vertical = edge.tipo === "final" && edge.from !== "final-agrupamento";
        return [{
          ...edge,
          x1: vertical ? a.left + a.width / 2 - base.left : a.right - base.left,
          y1: vertical ? a.bottom - base.top : a.top + a.height / 2 - base.top,
          x2: vertical ? b.left + b.width / 2 - base.left : b.left - base.left,
          y2: vertical ? b.top - base.top : b.top + b.height / 2 - base.top,
        }];
      });
      setPositions(novas);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    nodeRefs.current.forEach((node) => observer.observe(node));
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [edges]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2a3a5b] bg-[#0b1428] shadow-2xl shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111d35] px-5 py-3">
        <div>
          <h2 className="font-mono text-xs font-bold uppercase tracking-[.14em] text-slate-200">
            {compact ? `Caminho da OP ${ops[0]?.sequencia ?? ""}` : "Fluxo ativo das OPs"}
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            {compact ? `${ops[0]?.codigo ?? ""} · fabricação das partes até a linha final` : "A espessura da linha representa o volume solicitado ao setor."}
          </p>
        </div>
        {!compact && <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpSelecionada(null)}
            className={`rounded-md border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider ${opSelecionada === null ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200" : "border-white/10 bg-white/5 text-slate-400"}`}
          >
            Fluxo consolidado
          </button>
          {opSelecionada && (
            <span className="rounded-md border border-violet-400/40 bg-violet-400/10 px-3 py-2 font-mono text-[10px] uppercase text-violet-200">
              OP selecionada
            </span>
          )}
        </div>}
      </div>

      <div ref={containerRef} className={`relative p-5 ${compact ? "min-w-[900px]" : "min-w-[1180px]"}`}>
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <filter id="flow-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {positions.map((edge) => {
            const vertical = Math.abs(edge.x2 - edge.x1) < 12;
            const distancia = vertical
              ? Math.max(20, (edge.y2 - edge.y1) * 0.45)
              : Math.max(30, (edge.x2 - edge.x1) * 0.45);
            const d = vertical
              ? `M ${edge.x1} ${edge.y1} C ${edge.x1} ${edge.y1 + distancia}, ${edge.x2} ${edge.y2 - distancia}, ${edge.x2} ${edge.y2}`
              : `M ${edge.x1} ${edge.y1} C ${edge.x1 + distancia} ${edge.y1}, ${edge.x2 - distancia} ${edge.y2}, ${edge.x2} ${edge.y2}`;
            const width = edge.tipo === "final" ? 3 : 2 + Math.min(6, (edge.quantidade / maxVolume) * 6);
            const mostrarRotulo = edge.tipo === "op" && (opSelecionada !== null || opsNoFluxo.length <= 6);
            const mx = (edge.x1 + edge.x2) / 2;
            const my = (edge.y1 + edge.y2) / 2;
            return (
              <g key={edge.id}>
                <path d={d} fill="none" stroke={edge.cor} strokeWidth={width + 5} opacity=".08" />
                <path d={d} fill="none" stroke={edge.cor} strokeWidth={width} strokeLinecap="round" opacity={edge.quantidade > 0 ? ".82" : ".22"} filter="url(#flow-glow)" />
                {mostrarRotulo && (
                  <g transform={`translate(${mx - 25} ${my - 10})`}>
                    <rect width="50" height="19" rx="6" fill="#07101f" stroke={edge.cor} strokeOpacity=".55" />
                    <text x="25" y="13" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontFamily="monospace">{edge.quantidade} pçs</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        <div className={`relative z-10 grid gap-x-20 ${compact ? "grid-cols-[350px_250px_210px]" : "grid-cols-[250px_330px_250px_210px]"}`}>
          {!compact && <section>
            <ColumnTitle title="OPs abertas" subtitle={`${opsVisiveis.length} ordens no mapa`} />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar OP ou modelo"
              className="mb-3 w-full rounded-md border border-white/10 bg-[#07101f] px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
            />
            <div className="space-y-3">
              {opsVisiveis.map((op) => {
                const ativa = opSelecionada === op.id;
                const apagada = opSelecionada !== null && !ativa;
                return (
                  <button
                    key={op.id}
                    ref={registerNode(`op-${op.id}`)}
                    type="button"
                    onClick={() => setOpSelecionada(ativa ? null : op.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-all ${ativa ? "border-violet-400/70 bg-violet-400/15 shadow-[0_0_22px_rgba(167,139,250,.18)]" : "border-[#314361] bg-[#111d33] hover:border-cyan-400/50"} ${apagada ? "opacity-35" : "opacity-100"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-300">OP {op.sequencia}</span>
                      <span className="font-mono text-[10px] text-slate-500">{op.quantidade} engates</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-200">{op.codigo}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {op.demandas.map((demanda) => (
                        <span key={demanda.setorId} className="rounded bg-white/[.06] px-1.5 py-1 font-mono text-[8px] uppercase text-slate-400">
                          {nomeCurto(demanda.setorNome)} · {demanda.necessaria}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-emerald-300">{op.kits}/{op.quantidade} kits possíveis</p>
                  </button>
                );
              })}
            </div>
          </section>}

          <section>
            <ColumnTitle title="Setores de fabricação" subtitle="Partes produzidas em paralelo" />
            <div className={`space-y-4 ${compact ? "" : "pt-11"}`}>
              {setoresVisiveis.map((setor) => {
                const demandaSelecionada = opSelecionada
                  ? opsNoFluxo.flatMap((op) => op.demandas).filter((demanda) => demanda.setorId === setor.id)
                  : null;
                const necessaria = demandaSelecionada
                  ? demandaSelecionada.reduce((soma, demanda) => soma + demanda.necessaria, 0)
                  : setor.necessaria;
                const pronta = demandaSelecionada
                  ? demandaSelecionada.reduce((soma, demanda) => soma + demanda.pronta, 0)
                  : setor.pronta;
                const opsSetor = opSelecionada ? (demandaSelecionada?.length ? 1 : 0) : setor.ops;
                const pct = necessaria ? Math.round((pronta / necessaria) * 100) : 0;
                const ativo = necessaria > 0;
                return (
                  <article
                    key={setor.id}
                    ref={registerNode(`setor-${setor.id}`)}
                    className={`rounded-xl border p-4 transition-opacity ${ativo ? "border-[#36547a] bg-[#101d34]" : "border-white/[.06] bg-[#0c1628] opacity-35"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-100">{setor.nome}</h3>
                        <p className="mt-1 text-[10px] text-slate-500">{opsSetor} OPs · demanda {necessaria} peças</p>
                      </div>
                      <span className="font-mono text-lg font-bold text-cyan-300">{pct}%</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ width: `${pct}%` }} /></div>
                    <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[9px] uppercase tracking-wider">
                      <span className="text-emerald-300">{pronta} prontas</span>
                      <span className="text-right text-amber-300">{Math.max(necessaria - pronta, 0)} pendentes</span>
                    </div>
                    {setor.processos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1 border-t border-white/[.06] pt-2">
                        {setor.processos.map((processo) => (
                          <span key={processo.nome} className="rounded bg-white/[.05] px-1.5 py-1 font-mono text-[8px] uppercase text-slate-500">{processo.nome}</span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col justify-center">
            <ColumnTitle title="Convergência" subtitle="Formação dos kits" />
            {linhaFinal.slice(0, 1).map((etapa) => (
              <FinalNode key={etapa.nome} etapa={etapa} nodeRef={registerNode(`final-${slug(etapa.nome)}`)} primary />
            ))}
            <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[.06] p-3 text-[10px] leading-relaxed text-amber-100/70">
              As peças dos setores convergem aqui. Um kit só é liberado quando todos os componentes da OP estão disponíveis.
            </div>
          </section>

          <section className="flex flex-col justify-center">
            <ColumnTitle title="Linha final" subtitle="Engate como conjunto" />
            <div className="space-y-12">
              {linhaFinal.slice(1).map((etapa) => (
                <FinalNode key={etapa.nome} etapa={etapa} nodeRef={registerNode(`final-${slug(etapa.nome)}`)} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function FinalNode({ etapa, nodeRef, primary = false }: { etapa: FlowFinal; nodeRef: (element: HTMLElement | null) => void; primary?: boolean }) {
  const pct = etapa.necessaria ? Math.round((etapa.quantidade / etapa.necessaria) * 100) : 0;
  return (
    <article ref={nodeRef} className={`rounded-xl border p-4 ${primary ? "border-amber-400/55 bg-amber-400/[.09] shadow-[0_0_24px_rgba(251,191,36,.1)]" : "border-[#36547a] bg-[#101d34]"}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${primary ? "border-amber-400/35 bg-amber-400/10 text-amber-300" : "border-cyan-400/25 bg-cyan-400/10 text-cyan-300"}`}>
          <EtapaIcon nome={etapa.nome} />
        </span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">{etapa.nome}</h3>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">{etapa.ops} OPs em processo</p>
      <div className="mt-3 flex items-end justify-between"><span className="font-mono text-xl font-bold text-cyan-300">{etapa.quantidade}</span><span className="font-mono text-[9px] text-slate-500">de {etapa.necessaria}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={`h-full ${primary ? "bg-amber-400" : "bg-cyan-400"}`} style={{ width: `${pct}%` }} /></div>
    </article>
  );
}

function EtapaIcon({ nome }: { nome: string }) {
  const etapa = slug(nome);
  if (etapa === "agrupamento") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4.5 w-4.5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h5l3 5"/><path d="M3 19h5l3-5"/><path d="M3 12h8"/><path d="M11 8h10v8H11z"/><path d="m14 11 2 2 3-4"/></svg>;
  }
  if (etapa === "solda") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4.5 w-4.5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m4 19 7-7"/><path d="m9 10 5-5 5 5-5 5z"/><path d="M3 21h8"/><path d="M18 3v2M22 7h-2M20.5 4.5 19 6"/></svg>;
  }
  if (etapa === "pintura") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4.5 w-4.5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h10l3 3-3 3H9l-2 6H3l2-8z"/><path d="M17 7h1M20 6h1M20 10h2"/></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4.5 w-4.5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6.5a4 4 0 0 0-5-5l2.2 2.2-3 3L6.5 4.5a4 4 0 0 0 5 5L20 18l-2 2z"/><path d="m5 19 4-4"/></svg>;
}

function ColumnTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-4"><p className="font-mono text-[10px] font-bold uppercase tracking-[.15em] text-cyan-300">{title}</p><p className="mt-1 text-[10px] text-slate-600">{subtitle}</p></div>;
}

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "-");
}

function nomeCurto(value: string) {
  return value.replace("COMPONENTES E ACESSÓRIOS", "COMP./ACESS.").replace("PLASMA ", "P. ");
}
