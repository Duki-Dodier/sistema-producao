import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { calcularRastreamento } from "@/lib/rastreamento";
import { calcularProgressoOPs } from "@/lib/pcp";
import { PROCESSO_LABEL, PROCESSOS } from "@/lib/processos";
import { ehSetor, ehSetorFinal } from "@/lib/setores";
import { ProductionFlowMap } from "@/components/production-flow-map";
import { montarFluxoProducao } from "@/lib/fluxo-producao";

type FluxoPageProps = {
  searchParams: Promise<{ op?: string; versao?: string }>;
};

export default async function FluxoFabricaPage(props: FluxoPageProps) {
  const params = await props.searchParams;
  if (params.versao === "nova") {
    return <FluxoProducaoAtual searchParams={Promise.resolve(params)} />;
  }
  return <FluxoFabricaAnterior searchParams={Promise.resolve(params)} />;
}

async function FluxoProducaoAtual({ searchParams }: FluxoPageProps) {
  const { op: opParam } = await searchParams;
  const opInicial = opParam ? Number(opParam) : null;
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
      orderBy: { numeroSequencia: "asc" },
    }),
    prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } }),
  ]);
  const { flowOps, flowSetores, flowFinal } = montarFluxoProducao(ops, setores);
  const demandaTotal = flowSetores.reduce((soma, setor) => soma + setor.necessaria, 0);
  const prontaTotal = flowSetores.reduce((soma, setor) => soma + setor.pronta, 0);

  return (
    <div className="min-h-full bg-[#080f20] p-6 text-slate-100">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-cyan-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
              Produção em tempo real
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Fluxo das ordens em produção</h1>
            <p className="mt-1 text-sm text-slate-500">Das OPs abertas aos setores que fabricam as partes, até a formação do engate.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/monitoramento/fluxo" className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-200">
              Ver versão do Monitoramento
            </Link>
            <Link href="/monitoramento" className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/20">
              ← Voltar para OPs
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="OPs abertas" value={String(flowOps.length)} />
          <Metric label="Demanda de componentes" value={demandaTotal.toLocaleString("pt-BR")} />
          <Metric label="Componentes prontos" value={prontaTotal.toLocaleString("pt-BR")} />
          <Metric label="A produzir" value={Math.max(demandaTotal - prontaTotal, 0).toLocaleString("pt-BR")} alert />
        </div>

        <div className="overflow-x-auto pb-2">
          <ProductionFlowMap
            ops={flowOps}
            setores={flowSetores}
            linhaFinal={flowFinal}
            opInicial={opInicial}
          />
        </div>
        <p className="text-xs text-slate-600">Clique em uma OP para isolar suas rotas. Use “Fluxo consolidado” para voltar a enxergar todas as demandas.</p>
      </div>
    </div>
  );
}

type CardSetor = {
  id: number;
  nome: string;
  ops: number;
  entrada: number;
  pronta: number;
  pendente: number;
  processos: { nome: string; feito: number; total: number }[];
};

async function FluxoFabricaAnterior({
  searchParams,
}: FluxoPageProps) {
  const { op: opParam } = await searchParams;
  const opId = opParam ? Number(opParam) : null;
  const [ops, setores] = await Promise.all([
    prisma.oP.findMany({
      where: { status: "ABERTA", ...(opId ? { id: opId } : {}) },
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
      orderBy: { numeroSequencia: "asc" },
    }),
    prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } }),
  ]);

  const rastreamento = calcularRastreamento(ops);
  const progresso = calcularProgressoOPs(ops);
  const produtivos: CardSetor[] = setores
    .filter((setor) => !ehSetorFinal(setor.nome))
    .map((setor) => {
      const pecas = rastreamento.flatMap((item) =>
        item.pecas.filter((peca) => peca.setorId === setor.id).map((peca) => ({ ...peca, opId: item.op.id })),
      );
      return {
        id: setor.id,
        nome: setor.nome,
        ops: new Set(pecas.map((peca) => peca.opId)).size,
        entrada: pecas.reduce((soma, peca) => soma + peca.necessaria, 0),
        pronta: pecas.reduce((soma, peca) => soma + peca.pronta, 0),
        pendente: pecas.reduce((soma, peca) => soma + peca.falta, 0),
        processos: PROCESSOS.map((processo) => {
          const etapas = pecas.flatMap((peca) => peca.processos.filter((etapa) => etapa.codigo === processo));
          return {
            nome: PROCESSO_LABEL[processo],
            feito: etapas.reduce((soma, etapa) => soma + etapa.quantidade, 0),
            total: etapas.reduce((soma, etapa) => soma + etapa.necessaria, 0),
          };
        }).filter((item) => item.total > 0),
      };
    });

  const finais = ["Abastecimento", "Solda", "Pintura", "Montagem"].map((nome) => {
    const setor = setores.find((item) => ehSetor(item.nome, nome));
    const etapas = progresso.flatMap((item) => item.setores.filter((etapa) => ehSetor(etapa.setorNome, nome)));
    return {
      id: setor?.id ?? nome,
      nome,
      ops: etapas.filter((etapa) => !etapa.completo).length,
      entrada: etapas.reduce((soma, etapa) => soma + etapa.quantidadeBoa + etapa.falta, 0),
      pronta: etapas.reduce((soma, etapa) => soma + etapa.quantidadeBoa, 0),
      pendente: etapas.reduce((soma, etapa) => soma + etapa.falta, 0),
    };
  });
  const gargalo = [...produtivos].filter((setor) => setor.entrada > 0).sort(
    (a, b) => b.pendente / b.entrada - a.pendente / a.entrada,
  )[0];
  const opSelecionada = ops.length === 1 && opId ? ops[0] : null;
  const totalPendente = produtivos.reduce((soma, setor) => soma + setor.pendente, 0);

  return (
    <div className="min-h-full bg-[#080f20] p-6 text-slate-100">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-cyan-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
              Fluxo ativo da fábrica
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Mapa de fluxo e acumulação</h1>
            <p className="mt-1 text-sm text-slate-500">
              {opSelecionada
                ? `Rastreando OP ${opSelecionada.numeroSequencia} · ${opSelecionada.modelo.codigo}`
                : "Todos os setores · gargalo definido pela maior proporção pendente"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/#andamento-ops" className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/20">
              Ver fluxo no Painel Geral
            </Link>
            {opSelecionada && (
              <Link href="/monitoramento/fluxo" className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10">
                Remover filtro da OP
              </Link>
            )}
            <Link href="/monitoramento" className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/20">
              ← Voltar para OPs
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="OPs analisadas" value={String(ops.length)} />
          <Metric label="Peças pendentes" value={totalPendente.toLocaleString("pt-BR")} alert />
          <Metric label="Setor limitante" value={gargalo?.nome ?? "—"} alert={Boolean(gargalo?.pendente)} small />
          <Metric label="Fila no limitante" value={gargalo ? String(gargalo.pendente) : "0"} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#263653] bg-[#0d162a] shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#121d34] px-5 py-3">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
              Fabricação das partes <span className="mx-2 text-slate-700">→</span> linha final
            </div>
            <div className="flex flex-wrap gap-4 font-mono text-[9px] uppercase tracking-wider text-slate-500">
              <Legend color="bg-emerald-400" label="Concluído" />
              <Legend color="bg-cyan-400" label="Em fluxo" />
              <Legend color="bg-amber-400" label="Próximo destino" />
              <Legend color="bg-red-500" label="Gargalo" />
            </div>
          </div>

          <div className="relative grid gap-8 p-5 xl:grid-cols-[minmax(520px,1.5fr)_80px_minmax(260px,.7fr)]">
            <div className="grid gap-4 md:grid-cols-2">
              {produtivos.map((setor) => (
                <SectorCard key={setor.id} setor={setor} gargalo={gargalo?.id === setor.id && setor.pendente > 0} />
              ))}
            </div>

            <div className="hidden items-center justify-center xl:flex">
              <div className="relative h-[82%] w-full">
                <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-gradient-to-r from-cyan-500 via-amber-400 to-amber-300 shadow-[0_0_16px_rgba(34,211,238,.45)]" />
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-3xl text-amber-300">›</span>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3">
              {finais.map((setor, index) => (
                <div key={setor.id}>
                  <FinalCard setor={setor} destaque={index === 0} />
                  {index < finais.length - 1 && (
                    <div className="mx-auto flex h-8 w-6 items-center justify-center border-l-2 border-dashed border-cyan-400/50 text-cyan-400">↓</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          O mapa usa apontamentos reais por OP, peça e processo. Registros antigos sem processo são tratados como peças concluídas no setor para preservar o histórico.
        </p>
      </div>
    </div>
  );
}

function SectorCard({ setor, gargalo }: { setor: CardSetor; gargalo: boolean }) {
  const pct = setor.entrada ? Math.round((setor.pronta / setor.entrada) * 100) : 0;
  return (
    <article className={`relative rounded-xl border p-4 ${gargalo ? "border-red-500/70 bg-red-500/[.08] shadow-[0_0_26px_rgba(239,68,68,.18)]" : "border-[#314364] bg-[#111d34]"}`}>
      {gargalo && <span className="absolute -top-2.5 right-3 rounded-full border border-red-400/60 bg-[#461525] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-red-200">Gargalo ativo</span>}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider">{setor.nome}</h2>
          <p className="mt-1 text-[11px] text-slate-500">{setor.ops} OPs · {setor.entrada} peças</p>
        </div>
        <span className={`font-mono text-lg font-bold ${gargalo ? "text-red-300" : "text-cyan-300"}`}>{pct}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${gargalo ? "bg-red-500" : "bg-cyan-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 space-y-1.5">
        {setor.processos.map((processo) => {
          const processoPct = processo.total ? Math.round((processo.feito / processo.total) * 100) : 0;
          return (
            <div key={processo.nome} className="grid grid-cols-[100px_1fr_38px] items-center gap-2 font-mono text-[9px] uppercase text-slate-500">
              <span>{processo.nome}</span>
              <div className="h-1 rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-500/70" style={{ width: `${processoPct}%` }} /></div>
              <span className="text-right text-slate-400">{processoPct}%</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between border-t border-white/[.06] pt-2 font-mono text-[10px]">
        <span className="text-emerald-300">{setor.pronta} prontas</span>
        <span className={setor.pendente ? "text-amber-300" : "text-slate-500"}>{setor.pendente} pendentes →</span>
      </div>
    </article>
  );
}

function FinalCard({ setor, destaque }: { setor: { nome: string; ops: number; entrada: number; pronta: number; pendente: number }; destaque: boolean }) {
  const pct = setor.entrada ? Math.round((setor.pronta / setor.entrada) * 100) : 0;
  return (
    <article className={`rounded-xl border p-4 ${destaque ? "border-amber-400/50 bg-amber-400/[.07]" : "border-[#314364] bg-[#111d34]"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider">{setor.nome}</h2>
          <p className="mt-1 text-[10px] text-slate-500">{setor.ops} OPs em aberto</p>
        </div>
        <span className={destaque ? "font-mono text-sm font-bold text-amber-300" : "font-mono text-sm font-bold text-cyan-300"}>{setor.pronta}/{setor.entrada}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={destaque ? "h-full bg-amber-400" : "h-full bg-cyan-400"} style={{ width: `${pct}%` }} /></div>
    </article>
  );
}

function Metric({ label, value, alert = false, small = false }: { label: string; value: string; alert?: boolean; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#111a2c] px-4 py-3">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[.14em] text-slate-500">{label}</p>
      <p className={`mt-1 font-mono font-bold ${small ? "text-lg" : "text-2xl"} ${alert ? "text-amber-300" : "text-slate-100"}`}>{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>;
}
