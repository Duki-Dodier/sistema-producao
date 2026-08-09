import { prisma } from "@/lib/prisma";
import { calcularProgressoOPs } from "@/lib/pcp";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { StatCard } from "@/components/stat-card";
import { MiniBarChart } from "@/components/mini-bar-chart";
import Link from "next/link";
import { montarFluxoProducao } from "@/lib/fluxo-producao";
import { calcularRastreamento } from "@/lib/rastreamento";
import { ehSetor } from "@/lib/setores";
import { DashboardOPFlow, type DashboardFlowItem } from "@/components/dashboard-op-flow";

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

  const inicioUltimosSeteDias = new Date();
  inicioUltimosSeteDias.setDate(inicioUltimosSeteDias.getDate() - 7);

  const [ops, setores, apontamentosRecentes] = await Promise.all([
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
    prisma.apontamento.findMany({
      where: { dataHora: { gte: inicioUltimosSeteDias } },
      select: { quantidadeBoa: true, dataHora: true },
    }),
  ]);

  let progresso = calcularProgressoOPs(ops).sort(
    (a, b) => a.op.numeroSequencia - b.op.numeroSequencia,
  );

  // Métricas gerais calculadas ANTES do filtro de visualização (refletem a fábrica toda).
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

  const pendenciasPorEtapa = setores
    .map((s) => ({
      label: s.nome,
      value: progresso
        .filter((p) => p.setorAtual?.setorId === s.id)
        .reduce((total, p) => total + (p.setorAtual?.falta ?? 0), 0),
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const producaoPorDia = Array.from({ length: 7 }).map((_, i) => {
    const dia = new Date();
    dia.setDate(dia.getDate() - (6 - i));
    const chave = dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const total = apontamentosRecentes
      .filter((a) => a.dataHora.toDateString() === dia.toDateString())
      .reduce((sum, a) => sum + a.quantidadeBoa, 0);
    return { label: chave, value: total };
  });

  // Filtros da lista "OPs em andamento".
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
      flowOp: flowOps[0],
      flowSetores,
      flowFinal,
    };
  });

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <PageHeader
        title="Painel do PCP"
        subtitle="Onde está cada OP, o que falta, e quais estão furando a sequência de liberação."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Peças no pré-pronto"
          value={quantidadePrePronto.toLocaleString("pt-BR")}
          accent="success"
          detail="kits concluídos aguardando agrupamento"
        />
        <StatCard
          label="OPs abertas"
          value={totalAbertas}
          detail="ordens em produção"
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Pendências por etapa"
            subtitle="Peças que faltam para concluir o setor atual de cada OP."
          />
          {pendenciasPorEtapa.length > 0 ? (
            <MiniBarChart data={pendenciasPorEtapa} />
          ) : (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              Nenhuma OP pendente em setor algum no momento.
            </p>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Produção (peças boas)"
            subtitle="Últimos 7 dias, todos os setores."
          />
          <MiniBarChart data={producaoPorDia} />
        </Card>
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3 px-5 py-4" method="get">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Buscar (OP ou modelo)
            </label>
            <input
              name="busca"
              defaultValue={sp.busca ?? ""}
              placeholder="Ex.: 15243 ou VW5004"
              className="w-48 rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Curva</label>
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
            <label className="text-xs font-medium text-slate-400">
              Setor pendente
            </label>
            <select
              name="setor"
              defaultValue={sp.setor ?? ""}
              className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Liberada de
            </label>
            <input
              type="date"
              name="inicio"
              defaultValue={sp.inicio ?? ""}
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">até</label>
            <input
              type="date"
              name="fim"
              defaultValue={sp.fim ?? ""}
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
          >
            Filtrar
          </button>
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 hover:text-slate-300"
          >
            Limpar
          </Link>
        </form>
      </Card>

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
