import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

type PainelSetorProducaoProps = {
  titulo: string;
  descricao: string;
  setoresAlvo: readonly string[];
};

const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function formatarDataHora(data: Date) {
  return FORMATO_DATA_HORA.format(data);
}

export async function PainelSetorProducao({
  titulo,
  descricao,
  setoresAlvo,
}: PainelSetorProducaoProps) {
  const todosSetores = await prisma.setor.findMany({
    select: { id: true, nome: true },
    orderBy: { ordemPadrao: "asc" },
  });
  const setores = todosSetores.filter((setor) =>
    setoresAlvo.some((nome) => ehSetor(setor.nome, nome)),
  );
  const setorIds = setores.map((setor) => setor.id);
  const filtroSetor = setorIds.length ? { in: setorIds } : -1;
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const [apontamentosHoje, ultimosApontamentos, emAndamento] = await Promise.all([
    prisma.apontamento.findMany({
      where: { setorId: filtroSetor, dataHora: { gte: inicioHoje } },
      select: {
        usuario: true,
        quantidadeBoa: true,
        quantidadeRefugo: true,
      },
    }),
    prisma.apontamento.findMany({
      where: { setorId: filtroSetor },
      orderBy: { dataHora: "desc" },
      take: 20,
      select: {
        id: true,
        dataHora: true,
        usuario: true,
        quantidadeBoa: true,
        processo: true,
        op: { select: { numeroSequencia: true, lote: true, modelo: { select: { codigo: true } } } },
        peca: { select: { codigo: true, nome: true } },
        maquina: { select: { codigo: true } },
      },
    }),
    prisma.producaoEmAndamento.findMany({
      where: { setorId: filtroSetor },
      orderBy: { iniciadoEm: "asc" },
      select: {
        id: true,
        iniciadoEm: true,
        processo: true,
        quantidadePrevista: true,
        op: { select: { numeroSequencia: true, lote: true, modelo: { select: { codigo: true } } } },
        peca: { select: { codigo: true, nome: true } },
        funcionario: { select: { nome: true } },
        maquina: { select: { codigo: true, nome: true } },
      },
    }),
  ]);

  const quantidadeHoje = apontamentosHoje.reduce(
    (total, apontamento) => total + apontamento.quantidadeBoa,
    0,
  );
  const refugoHoje = apontamentosHoje.reduce(
    (total, apontamento) => total + apontamento.quantidadeRefugo,
    0,
  );
  const operadoresHoje = new Set(apontamentosHoje.map((apontamento) => apontamento.usuario)).size;

  return (
    <div className="flex min-h-full w-full flex-col gap-5 bg-[#0b1326] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">
            Produção por setor
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#dae2fd]">{titulo}</h1>
          <p className="mt-1 text-xs text-slate-400">{descricao}</p>
        </div>
        <Link
          href="/monitoramento?visao=setor"
          className="rounded border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-200 transition-colors hover:bg-cyan-400/20"
        >
          Ver monitoramento geral
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {setores.map((setor) => (
          <span
            key={setor.id}
            className="rounded border border-slate-700 bg-[#131b2e] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300"
          >
            {setor.nome}
          </span>
        ))}
        {setores.length === 0 && (
          <span className="rounded border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
            Setor ainda não cadastrado.
          </span>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica label="Produzido hoje" valor={quantidadeHoje.toLocaleString("pt-BR")} cor="text-emerald-300" />
        <Metrica label="Apontamentos hoje" valor={String(apontamentosHoje.length)} cor="text-cyan-300" />
        <Metrica label="Operadores ativos" valor={String(operadoresHoje)} cor="text-[#dae2fd]" />
        <Metrica label="Refugo hoje" valor={refugoHoje.toLocaleString("pt-BR")} cor="text-amber-300" />
      </section>

      <section className="overflow-hidden rounded-lg border border-[#2d3449] bg-[#131b2e]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2d3449] bg-[#171f33] px-5 py-3">
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#dae2fd]">
              Processos em andamento
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Ciclos iniciados e ainda não finalizados.</p>
          </div>
          <span className="rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] font-bold text-cyan-300">
            {emAndamento.length} ativo{emAndamento.length === 1 ? "" : "s"}
          </span>
        </div>
        <TabelaProcessos itens={emAndamento} />
      </section>

      <section className="overflow-hidden rounded-lg border border-[#2d3449] bg-[#131b2e]">
        <div className="border-b border-[#2d3449] bg-[#171f33] px-5 py-3">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#dae2fd]">
            Últimos apontamentos
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">Os 20 lançamentos mais recentes do setor.</p>
        </div>
        <TabelaApontamentos itens={ultimosApontamentos} />
      </section>
    </div>
  );
}

function Metrica({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-lg border border-[#2d3449] bg-[#131b2e] px-4 py-3 shadow-lg">
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold ${cor}`}>{valor}</p>
    </div>
  );
}

function TabelaProcessos({
  itens,
}: {
  itens: Awaited<ReturnType<typeof prisma.producaoEmAndamento.findMany>>;
}) {
  if (itens.length === 0) {
    return <p className="px-5 py-9 text-center text-sm text-slate-500">Nenhum processo em andamento neste momento.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs text-slate-300">
        <thead className="border-b border-white/5 bg-[#0e1728] font-mono text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Iniciado</th>
            <th className="px-4 py-3 font-semibold">OP / modelo</th>
            <th className="px-4 py-3 font-semibold">Peça</th>
            <th className="px-4 py-3 font-semibold">Processo</th>
            <th className="px-4 py-3 font-semibold">Operador</th>
            <th className="px-4 py-3 font-semibold">Máquina</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {itens.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-white/[0.03]">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-400">{formatarDataHora(item.iniciadoEm)}</td>
              <td className="whitespace-nowrap px-4 py-3"><b className="font-mono text-slate-100">OP {item.op.numeroSequencia}</b><span className="ml-2 font-mono text-cyan-200">{item.op.modelo.codigo}</span></td>
              <td className="px-4 py-3">{item.peca ? `${item.peca.codigo}${item.peca.nome ? ` · ${item.peca.nome}` : ""}` : "—"}</td>
              <td className="px-4 py-3 font-mono text-slate-300">{item.processo ?? "—"}</td>
              <td className="px-4 py-3">{item.funcionario.nome}</td>
              <td className="px-4 py-3 font-mono text-slate-300">{item.maquina.codigo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaApontamentos({
  itens,
}: {
  itens: Awaited<ReturnType<typeof prisma.apontamento.findMany>>;
}) {
  if (itens.length === 0) {
    return <p className="px-5 py-9 text-center text-sm text-slate-500">Ainda não há apontamentos neste setor.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs text-slate-300">
        <thead className="border-b border-white/5 bg-[#0e1728] font-mono text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Data e hora</th>
            <th className="px-4 py-3 font-semibold">OP / modelo</th>
            <th className="px-4 py-3 font-semibold">Peça</th>
            <th className="px-4 py-3 font-semibold">Processo</th>
            <th className="px-4 py-3 font-semibold">Operador</th>
            <th className="px-4 py-3 text-right font-semibold">Quantidade</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {itens.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-white/[0.03]">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-400">{formatarDataHora(item.dataHora)}</td>
              <td className="whitespace-nowrap px-4 py-3"><b className="font-mono text-slate-100">OP {item.op.numeroSequencia}</b><span className="ml-2 font-mono text-cyan-200">{item.op.modelo.codigo}</span></td>
              <td className="px-4 py-3">{item.peca ? `${item.peca.codigo}${item.peca.nome ? ` · ${item.peca.nome}` : ""}` : "—"}</td>
              <td className="px-4 py-3 font-mono text-slate-300">{item.processo ?? "—"}</td>
              <td className="px-4 py-3">{item.usuario}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-emerald-300">{item.quantidadeBoa.toLocaleString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
