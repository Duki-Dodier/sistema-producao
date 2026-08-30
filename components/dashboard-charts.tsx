import { Card, CardHeader } from "@/components/card";

export type DashboardChartItem = {
  label: string;
  value: number;
  detail?: string;
};

function vazio(mensagem: string) {
  return <p className="px-5 py-8 text-center text-sm text-slate-500">{mensagem}</p>;
}

export function DashboardCharts({
  pendencias,
  progressoPorCurva,
  tempoAberto,
}: {
  pendencias: DashboardChartItem[];
  progressoPorCurva: DashboardChartItem[];
  tempoAberto: DashboardChartItem[];
}) {
  const maxPendencias = Math.max(1, ...pendencias.map((item) => item.value));
  const maxTempo = Math.max(1, ...tempoAberto.map((item) => item.value));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader
          title="Pendências por etapa"
          subtitle="Peças que faltam no setor atual das OPs filtradas."
        />
        {pendencias.length === 0 ? (
          vazio("Nenhuma pendência encontrada.")
        ) : (
          <div className="space-y-3 px-5 py-5">
            {pendencias.slice(0, 7).map((item) => (
              <div key={item.label} className="grid grid-cols-[112px_1fr_auto] items-center gap-3">
                <span className="truncate text-[11px] font-medium text-slate-400" title={item.label}>
                  {item.label}
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all"
                    style={{ width: `${Math.max((item.value / maxPendencias) * 100, 4)}%` }}
                  />
                </div>
                <span className="font-mono text-xs font-semibold tabular-nums text-slate-200">
                  {item.value.toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
            {pendencias.length > 7 && (
              <p className="pt-1 text-[10px] text-slate-600">Exibindo as 7 maiores pendências.</p>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Progresso médio por classe"
          subtitle="Conclusão média das OPs abertas por curva ABC."
        />
        {progressoPorCurva.length === 0 ? (
          vazio("Nenhuma OP encontrada.")
        ) : (
          <div className="space-y-4 px-5 py-5">
            {progressoPorCurva.map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Classe {item.label}</span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-emerald-300">{item.value}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${Math.max(0, Math.min(item.value, 100))}%` }}
                  />
                </div>
                {item.detail && <p className="mt-1 text-[10px] text-slate-600">{item.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Tempo em aberto"
          subtitle="Quantidade de OPs por faixa desde a liberação."
        />
        {tempoAberto.length === 0 ? (
          vazio("Nenhuma OP encontrada.")
        ) : (
          <div className="flex h-[166px] items-end gap-3 px-5 pb-5 pt-4">
            {tempoAberto.map((item) => (
              <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className="font-mono text-xs font-semibold tabular-nums text-slate-200">{item.value}</span>
                <div className="flex h-24 w-full items-end rounded-sm bg-slate-900/60">
                  <div
                    className="w-full rounded-t-sm bg-amber-400/80 transition-all"
                    style={{ height: `${Math.max((item.value / maxTempo) * 100, item.value > 0 ? 8 : 0)}%` }}
                  />
                </div>
                <span className="truncate text-center text-[10px] text-slate-500" title={item.label}>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
