import { prisma } from "@/lib/prisma";
import { calcularProgressoOPs } from "@/lib/pcp";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { StatCard } from "@/components/stat-card";
import Link from "next/link";
import { montarFluxoProducao } from "@/lib/fluxo-producao";
import { calcularRastreamento } from "@/lib/rastreamento";
import { ehSetor } from "@/lib/setores";
import { DashboardOPFlow, type DashboardFlowItem } from "@/components/dashboard-op-flow";
import { DashboardCharts } from "@/components/dashboard-charts";
import { DashboardOpenOps, type DashboardOpenOpItem } from "@/components/dashboard-open-ops";

export default async function PainelPcpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim().toLowerCase();
  const curva = sp.curva ?? "";
  const setorPendenteId = sp.setor ? Number(sp.setor) : null;
  const dataInicio = sp.inicio ? new Date(sp.inicio) : null;
  const dataFim = sp.fim ? new Date(`${sp.fim}T23:59:59`) : null;

  const [ops, setores] = await Promise.all([
    prisma.oP.findMany({
      where: { status: "ABERTA" },
      include: {
        modelo: {
          include: {
            roteiro: { include: { setor: true }, orderBy: { ordem: "asc" } },
            pecas: {
              include: {
                peca: {
                  include: {
                    roteiro: { include: { setor: true }, orderBy: { ordem: "asc" } },
                  },
                },
              },
            },
          },
        },
        apontamentos: true,
      },
    }),
    prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } }),
  ]);

  let progresso = calcularProgressoOPs(ops).sort(
    (a, b) => a.op.numeroSequencia - b.op.numeroSequencia,
  );

  const totalAbertasGeral = progresso.length;

  // Os filtros alimentam o resumo, os gráficos e a lista de OPs em andamento.
  progresso = progresso.filter((p) => {
    if (busca) {
      const alvo = `${p.op.numeroSequencia} ${p.op.lote ?? ""} ${p.op.modelo.codigo}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    if (curva && p.op.modelo.curva !== curva) return false;
    if (setorPendenteId && p.setorAtual?.setorId !== setorPendenteId) return false;
    if (dataInicio && p.op.dataLiberacao < dataInicio) return false;
    if (dataFim && p.op.dataLiberacao > dataFim) return false;
    return true;
  });

  const agora = new Date();
  const totalAbertas = progresso.length;
  const rastreamentoPorOp = new Map(calcularRastreamento(ops).map((item) => [item.op.id, item]));
  const quantidadePrePronto = progresso.reduce((total, item) => {
    const rastreamento = rastreamentoPorOp.get(item.op.id);
    if (rastreamento && rastreamento.pecas.length > 0) {
      return total + Math.min(item.op.quantidade, rastreamento.kitsCompletos);
    }

    const etapasPrePronto = item.setoresPreSolda.filter(
      (setor) => !ehSetor(setor.setorNome, "Agrupamento"),
    );
    const maiorQuantidadeProduzida = Math.max(
      0,
      ...etapasPrePronto.map((setor) => setor.quantidadeBoa),
    );
    return total + Math.min(item.op.quantidade, maiorQuantidadeProduzida);
  }, 0);

  const opsNaSolda = progresso.filter((item) => {
    const solda = item.setores.find((setor) => ehSetor(setor.setorNome, "Solda"));
    return Boolean(
      solda &&
        !solda.completo &&
        (item.setorAtual?.setorId === solda.setorId ||
          item.op.apontamentos.some((apontamento) => apontamento.setorId === solda.setorId)),
    );
  }).length;
  const opsProntasParaSolda = progresso.filter((item) => item.prontoParaSolda).length;

  const progressoMedio = totalAbertas > 0
    ? Math.round(progresso.reduce((total, item) => total + item.percentual, 0) / totalAbertas)
    : 0;
  const quantidadeEmOP = progresso.reduce((total, item) => total + item.op.quantidade, 0);
  const opsSemAvanco = progresso.filter((item) => item.percentual === 0).length;

  const progressoPorCurva = ["A", "B", "C"].map((classe) => {
    const grupo = progresso.filter((item) => item.op.modelo.curva === classe);
    return {
      label: classe,
      value: grupo.length > 0
        ? Math.round(grupo.reduce((total, item) => total + item.percentual, 0) / grupo.length)
        : 0,
      detail: `${grupo.length} OP${grupo.length === 1 ? "" : "s"} aberta${grupo.length === 1 ? "" : "s"}`,
    };
  });

  const tempoAberto = [
    { label: "Até 1 dia", value: 0 },
    { label: "2–3 dias", value: 0 },
    { label: "4–7 dias", value: 0 },
    { label: "Mais de 7", value: 0 },
  ];
  for (const item of progresso) {
    const dias = Math.max(0, (agora.getTime() - item.op.dataLiberacao.getTime()) / 86_400_000);
    if (dias <= 1) tempoAberto[0].value++;
    else if (dias <= 3) tempoAberto[1].value++;
    else if (dias <= 7) tempoAberto[2].value++;
    else tempoAberto[3].value++;
  }

  const pendenciasPorEtapa = setores
    .map((s) => ({
      label: s.nome,
      value: progresso
        .filter((p) => p.setorAtual?.setorId === s.id)
        .reduce((total, p) => total + (p.setorAtual?.falta ?? 0), 0),
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const sequenciamentoPorSetor = setores.map((setor) => {
    const fila = progresso
      .filter((item) => item.setorAtual?.setorId === setor.id)
      .sort((a, b) => a.op.numeroSequencia - b.op.numeroSequencia);
    const primeiro = fila[0] ?? null;
    return {
      setor: setor.nome,
      sequencia: primeiro?.op.numeroSequencia ?? null,
      codigo: primeiro?.op.modelo.codigo ?? null,
      fila: fila.length,
    };
  });

  const itensAbertas: DashboardOpenOpItem[] = progresso.map((item) => ({
    id: item.op.id,
    sequencia: item.op.numeroSequencia,
    codigo: item.op.modelo.codigo,
    nome: item.op.modelo.nome,
    estoqueRegulador: item.op.modelo.estoqueMinimo,
    curva: item.op.modelo.curva,
    setorAtual: item.setorAtual?.setorNome ?? null,
    percentual: item.percentual,
    doneCount: item.doneCount,
    totalCount: item.totalCount,
    quantidade: item.op.quantidade,
    liberadaEm: item.op.dataLiberacao.toISOString(),
  }));

  const itensFluxo: DashboardFlowItem[] = progresso.map((item) => {
    const { flowOps, flowSetores, flowFinal } = montarFluxoProducao([item.op], setores);
    return {
      id: item.op.id,
      sequencia: item.op.numeroSequencia,
      codigo: item.op.modelo.codigo,
      curva: item.op.modelo.curva,
      quantidade: item.op.quantidade,
      completo: item.completo,
      foraDeSequencia: item.foraDeSequencia,
      ultrapassadaPorSeq: item.ultrapassadaPorSeq,
      totalSetores: item.totalCount,
      setoresConcluidos: item.doneCount,
      percentual: item.percentual,
      setorAtual: item.setorAtual?.setorNome ?? null,
      faltaAtual: item.setorAtual?.falta ?? null,
      liberadaEm: item.op.dataLiberacao.toISOString(),
      flowOp: flowOps[0],
      flowSetores,
      flowFinal,
    };
  });

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <PageHeader
        title="Painel geral de produção"
        subtitle="Visão rápida das OPs abertas, andamento por setor e pendências da fábrica."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="OPs abertas"
          value={totalAbertas}
          detail={totalAbertasGeral !== totalAbertas ? `de ${totalAbertasGeral} no total` : "ordens em produção"}
        />
        <StatCard
          label="Conclusão média"
          value={`${progressoMedio}%`}
          accent={progressoMedio >= 70 ? "success" : progressoMedio >= 35 ? "warning" : "neutral"}
          detail="das etapas do roteiro"
        />
        <StatCard
          label="Peças no pré-pronto"
          value={quantidadePrePronto.toLocaleString("pt-BR")}
          accent="success"
          detail="kits concluídos aguardando agrupamento"
        />
        <StatCard
          label="Peças em OP"
          value={quantidadeEmOP.toLocaleString("pt-BR")}
          detail="quantidade programada"
        />
        <StatCard
          label="OPs na Solda"
          value={opsNaSolda}
          accent={opsNaSolda > 0 ? "warning" : "neutral"}
          detail="com envio ou apontamento ativo"
        />
        <StatCard
          label="Prontas para Solda"
          value={opsProntasParaSolda}
          accent="success"
          detail="pré-pronto completo"
        />
        <StatCard
          label="Sem avanço"
          value={opsSemAvanco}
          accent={opsSemAvanco > 0 ? "warning" : "success"}
          detail="OPs sem apontamento"
        />
      </div>

      <Card>
        <CardHeader title="Filtros do painel" subtitle="Os filtros atualizam os indicadores, gráficos e listas abaixo." />
        <form className="flex flex-wrap items-end gap-3 px-5 py-4" method="get">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Buscar (OP ou modelo)</label>
            <input
              name="busca"
              defaultValue={sp.busca ?? ""}
              placeholder="Ex.: 15243 ou VW5004"
              className="w-48 rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Classe ABC</label>
            <select
              name="curva"
              defaultValue={sp.curva ?? ""}
              className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Setor pendente</label>
            <select
              name="setor"
              defaultValue={sp.setor ?? ""}
              className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Liberada de</label>
            <input type="date" name="inicio" defaultValue={sp.inicio ?? ""} className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">até</label>
            <input type="date" name="fim" defaultValue={sp.fim ?? ""} className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <button type="submit" className="rounded-md bg-cyan-500 px-3.5 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-cyan-300">Aplicar filtros</button>
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-300">Limpar</Link>
        </form>
      </Card>

      <DashboardCharts
        pendencias={pendenciasPorEtapa}
        progressoPorCurva={progressoPorCurva}
        tempoAberto={tempoAberto}
      />

      <Card>
        <CardHeader
          title="Sequenciamento atual por setor"
          subtitle="Menor sequência da OP em produção em cada setor."
        />
        <div className="grid grid-cols-1 gap-2 px-5 py-4 md:grid-cols-2 xl:grid-cols-3">
          {sequenciamentoPorSetor.map((item) => (
            <div
              key={item.setor}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md border border-white/5 bg-[#202A36] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                  {item.setor}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">
                  {item.codigo
                    ? `OP ${item.sequencia} · ${item.codigo}`
                    : "Nenhuma OP em produção"}
                </p>
              </div>
              <span
                className={`rounded px-2 py-1 font-mono text-[11px] font-bold ${
                  item.sequencia === null
                    ? "bg-slate-700/50 text-slate-500"
                    : "bg-cyan-500/15 text-cyan-300"
                }`}
              >
                {item.sequencia === null ? "—" : `SEQ ${item.sequencia}`}
              </span>
              <span className="min-w-12 text-right text-[10px] text-slate-500">
                {item.fila > 0 ? `${item.fila} OP${item.fila === 1 ? "" : "s"}` : "Livre"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <DashboardOpenOps itens={itensAbertas} />

      <section id="andamento-ops" className="scroll-mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              OPs em andamento ({progresso.length})
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Clique em uma OP para visualizar seu caminho pelos setores da fábrica.
            </p>
          </div>
          <Link href="/monitoramento/fluxo" className="text-xs font-medium text-cyan-400 hover:text-cyan-300">
            Abrir mapa do Monitoramento →
          </Link>
        </div>
        <DashboardOPFlow itens={itensFluxo} />
      </section>
    </div>
  );
}
