import Link from "next/link";
import type { OPRastreada, ProcessoProgresso } from "@/lib/rastreamento";

const ESTADO_CLS: Record<ProcessoProgresso["estado"], string> = {
  concluido: "border-emerald-400/50 bg-emerald-400/15 text-emerald-300",
  andamento: "border-cyan-400/60 bg-cyan-400/15 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,.12)]",
  proximo: "border-amber-400/60 bg-amber-400/10 text-amber-200",
  pendente: "border-slate-700 bg-slate-900/50 text-slate-500",
};

export function OPTrackingBoard({ itens }: { itens: OPRastreada[] }) {
  if (itens.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#121a2c] px-6 py-16 text-center text-sm text-slate-500">
        Nenhuma OP aberta encontrada com esses filtros.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {itens.map((item, index) => {
        const completa = item.kitsCompletos >= item.op.quantidade;
        return (
          <details
            key={item.op.id}
            open={index === 0}
            className="group overflow-hidden rounded-xl border border-white/10 bg-[#111a2c] open:border-cyan-400/40 open:shadow-[0_0_24px_rgba(34,211,238,.08)]"
          >
            <summary className="grid cursor-pointer list-none grid-cols-[28px_90px_minmax(150px,1.3fr)_100px_minmax(180px,1fr)_minmax(160px,.8fr)] items-center gap-3 px-4 py-3 hover:bg-white/[.025] max-lg:grid-cols-[28px_80px_1fr_100px]">
              <span className="text-cyan-400 transition-transform group-open:rotate-90">›</span>
              <span className="font-mono text-xs font-bold text-cyan-300">
                OP {item.op.numeroSequencia}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold text-slate-100">
                  {item.op.modelo.codigo}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {item.op.modelo.nome ?? "Engate sem descrição"}
                </p>
              </div>
              <div className="text-center font-mono text-xs text-slate-300">
                {item.op.quantidade} un.
              </div>
              <div className="max-lg:hidden">
                <div className="mb-1 flex justify-between font-mono text-[10px] uppercase text-slate-500">
                  <span>Progresso industrial</span>
                  <span className="text-cyan-300">{item.progressoIndustrial}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                    style={{ width: `${item.progressoIndustrial}%` }}
                  />
                </div>
              </div>
              <div className="max-lg:hidden">
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Kits liberáveis
                </p>
                <p className={completa ? "font-mono text-sm font-bold text-emerald-300" : "font-mono text-sm font-bold text-amber-300"}>
                  {item.kitsCompletos} de {item.op.quantidade}
                </p>
              </div>
            </summary>

            <div className="border-t border-white/10 bg-[#0b1324] px-4 py-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider">
                  <Legend color="bg-emerald-400" label="Concluído" />
                  <Legend color="bg-cyan-400" label="Em execução" />
                  <Legend color="bg-amber-400" label="Próximo" />
                  <Legend color="bg-slate-600" label="Pendente" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-md border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 font-mono text-[10px] text-cyan-200">
                    Tempo da OP: {formatTempoOP(item.op.dataLiberacao, item.op.dataFinalizacao)}
                  </span>
                  {item.gargalo && (
                    <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200">
                      Limitante: <strong>{item.gargalo.codigo}</strong> · faltam {item.gargalo.falta}
                    </span>
                  )}
                  <Link
                    href={`/monitoramento/fluxo?op=${item.op.id}`}
                    className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/20"
                  >
                    Ver no mapa da fábrica →
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {item.setores.map((setor) => (
                  <section key={setor.setorId} className="overflow-hidden rounded-lg border border-white/10 bg-[#111b2e]">
                    <header className="flex items-center justify-between border-b border-white/10 bg-white/[.025] px-4 py-2.5">
                      <div>
                        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
                          {setor.setorNome}
                        </h3>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {setor.pecas.length} componente(s) neste setor
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {setor.pronta}/{setor.necessaria} prontas
                      </span>
                    </header>
                    <div className="divide-y divide-white/[.06]">
                      {setor.pecas.map((peca) => (
                        <div key={peca.chave} className="p-3">
                          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                            <div>
                              <span className="font-mono text-[11px] font-bold text-cyan-300">{peca.codigo}</span>
                              <span className="ml-2 text-xs text-slate-300">{peca.nome}</span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-500">
                              necessário {peca.necessaria} · pronto {peca.pronta}
                            </span>
                          </div>
                          <div className="flex min-w-max items-stretch gap-1 overflow-x-auto pb-1">
                            {peca.processos.map((processo, processoIndex) => (
                              <div key={processo.codigo} className="flex items-center gap-1">
                                <div className={`min-w-28 rounded border px-2.5 py-2 ${ESTADO_CLS[processo.estado]}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[10px] font-bold uppercase">{processo.nome}</span>
                                    <span>{processo.estado === "concluido" ? "✓" : processo.estado === "andamento" ? "●" : processo.estado === "proximo" ? "→" : "○"}</span>
                                  </div>
                                  <p className="mt-1 font-mono text-[10px] opacity-80">
                                    {processo.quantidade}/{processo.necessaria}
                                  </p>
                                </div>
                                {processoIndex < peca.processos.length - 1 && (
                                  <span className="text-slate-600">→</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function formatTempoOP(inicio: Date | string, fim: Date | string | null) {
  const inicioMs = new Date(inicio).getTime();
  const fimMs = fim ? new Date(fim).getTime() : Date.now();
  const segundos = Math.max(0, Math.floor((fimMs - inicioMs) / 1000));
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const partes = [
    dias > 0 ? `${dias}d` : "",
    horas > 0 ? `${horas}h` : "",
    `${minutos}min`,
  ].filter(Boolean);
  return fim ? partes.join(" ") : `em produção · ${partes.join(" ")}`;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
