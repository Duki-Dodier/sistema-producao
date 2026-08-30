"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/badge";
import { ProgressBar } from "@/components/progress-bar";
import {
  ProductionFlowMap,
  type FlowFinal,
  type FlowOP,
  type FlowSector,
} from "@/components/production-flow-map";
import { CURVA_VARIANT } from "@/lib/labels";

export type DashboardFlowItem = {
  id: number;
  sequencia: number;
  codigo: string;
  curva: string;
  quantidade: number;
  completo: boolean;
  foraDeSequencia: boolean;
  ultrapassadaPorSeq: number | null;
  totalSetores: number;
  setoresConcluidos: number;
  percentual: number;
  setorAtual: string | null;
  faltaAtual: number | null;
  liberadaEm: string;
  flowOp: FlowOP;
  flowSetores: FlowSector[];
  flowFinal: FlowFinal[];
};

export function DashboardOPFlow({ itens }: { itens: DashboardFlowItem[] }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [classe, setClasse] = useState("");
  const [ordenacao, setOrdenacao] = useState<"sequencia" | "antigas" | "proximas" | "maior">("sequencia");
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens
      .filter((item) => {
        if (classe && item.curva !== classe) return false;
        if (!termo) return true;
        return `${item.sequencia} ${item.codigo} ${item.setorAtual ?? ""}`.toLowerCase().includes(termo);
      })
      .sort((a, b) => {
        if (ordenacao === "antigas") return tempoAberto(b) - tempoAberto(a);
        if (ordenacao === "proximas") return b.percentual - a.percentual || a.sequencia - b.sequencia;
        if (ordenacao === "maior") return b.quantidade - a.quantidade || a.sequencia - b.sequencia;
        return a.sequencia - b.sequencia;
      });
  }, [busca, classe, itens, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 10));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * 10, paginaAtual * 10);

  if (itens.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#131b2e] px-5 py-10 text-center text-sm text-slate-400">
        Nenhuma OP encontrada com esses filtros.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#131b2e]">
      <div className="flex flex-wrap items-end gap-3 border-b border-white/5 px-5 py-4">
        <label className="flex min-w-[230px] flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Buscar nesta lista</span>
          <input
            value={busca}
            onChange={(event) => { setBusca(event.target.value); setPagina(1); }}
            placeholder="Seq., código ou setor"
            className="rounded-md border border-white/10 bg-[#0D1524] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400"
          />
        </label>
        <label className="flex w-28 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Classe</span>
          <select value={classe} onChange={(event) => { setClasse(event.target.value); setPagina(1); }} className="rounded-md border border-white/10 bg-[#0D1524] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400">
            <option value="">Todas</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </label>
        <label className="flex min-w-[190px] flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ordenar por</span>
          <select value={ordenacao} onChange={(event) => { setOrdenacao(event.target.value as typeof ordenacao); setPagina(1); }} className="rounded-md border border-white/10 bg-[#0D1524] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400">
            <option value="sequencia">Sequência</option>
            <option value="antigas">Mais tempo aberta</option>
            <option value="proximas">Mais próxima de concluir</option>
            <option value="maior">Maior quantidade</option>
          </select>
        </label>
      </div>
      <ul className="divide-y divide-white/5">
        {visiveis.map((item) => {
          const expandida = aberta === item.id;
          return (
            <Fragment key={item.id}>
              <li className={item.foraDeSequencia ? "bg-red-500/[.04]" : ""}>
                <button
                  type="button"
                  onClick={() => setAberta(expandida ? null : item.id)}
                  aria-expanded={expandida}
                  className={`grid w-full grid-cols-[28px_80px_160px_minmax(260px,1fr)_180px] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[.025] max-lg:grid-cols-[28px_70px_140px_1fr] ${expandida ? "bg-cyan-400/[.045]" : ""}`}
                >
                  <span className={`text-lg text-cyan-400 transition-transform ${expandida ? "rotate-90" : ""}`}>›</span>
                  <div className="flex flex-col items-start">
                    <span className="font-mono text-lg font-semibold text-slate-100">{item.sequencia}</span>
                    <span className="text-[9px] uppercase tracking-wide text-slate-500">sequência</span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-mono text-sm font-medium text-slate-200">{item.codigo}</span>
                    <Badge variant={CURVA_VARIANT[item.curva as "A" | "B" | "C"] ?? "neutral"} className="w-fit">
                      Curva {item.curva}
                    </Badge>
                  </div>
                  <div className="min-w-0">
                    {item.totalSetores === 0 ? (
                      <p className="text-sm text-amber-500">Modelo sem roteiro definido</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                          <span className="truncate">
                            {item.completo
                              ? "Kit completo — pronto para a linha final"
                              : `Falta ${item.setorAtual ?? "etapa"} — ${item.faltaAtual ?? 0} peças`}
                          </span>
                          <span className="shrink-0 tabular-nums">{item.setoresConcluidos}/{item.totalSetores} setores</span>
                        </div>
                        <div className="mt-1.5"><ProgressBar percentual={item.percentual} variant={item.completo ? "success" : "default"} /></div>
                      </>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 max-lg:hidden">
                    {item.completo && <Badge variant="success">Completo</Badge>}
                    {item.foraDeSequencia && <Badge variant="danger">OP {item.ultrapassadaPorSeq} passou na frente</Badge>}
                    {!item.completo && !item.foraDeSequencia && <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400">Ver caminho</span>}
                  </div>
                </button>
              </li>
              {expandida && (
                <li className="border-y border-cyan-400/20 bg-[#080f20] p-4">
                  <div className="overflow-x-auto pb-1">
                    <ProductionFlowMap
                      ops={[item.flowOp]}
                      setores={item.flowSetores}
                      linhaFinal={item.flowFinal}
                      opInicial={item.id}
                      compact
                    />
                  </div>
                </li>
              )}
            </Fragment>
          );
        })}
        {visiveis.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma OP encontrada nesta lista.</li>}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
        <span className="text-[11px] text-slate-500">Mostrando {filtrados.length === 0 ? 0 : (paginaAtual - 1) * 10 + 1}–{Math.min(paginaAtual * 10, filtrados.length)} de {filtrados.length} · 10 por página</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)} className="rounded border border-white/10 px-3 py-1.5 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/5">Anterior</button>
          <span className="font-mono text-xs text-slate-500">{paginaAtual}/{totalPaginas}</span>
          <button type="button" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina(paginaAtual + 1)} className="rounded border border-white/10 px-3 py-1.5 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/5">Próxima</button>
        </div>
      </div>
    </div>
  );
}

function tempoAberto(item: DashboardFlowItem) {
  return Math.max(0, Math.floor((Date.now() - new Date(item.liberadaEm).getTime()) / 1000));
}
