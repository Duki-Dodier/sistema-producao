"use client";

import { Fragment, useState } from "react";
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
  flowOp: FlowOP;
  flowSetores: FlowSector[];
  flowFinal: FlowFinal[];
};

export function DashboardOPFlow({ itens }: { itens: DashboardFlowItem[] }) {
  const [aberta, setAberta] = useState<number | null>(null);

  if (itens.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#131b2e] px-5 py-10 text-center text-sm text-slate-400">
        Nenhuma OP encontrada com esses filtros.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#131b2e]">
      <ul className="divide-y divide-white/5">
        {itens.map((item) => {
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
      </ul>
    </div>
  );
}
