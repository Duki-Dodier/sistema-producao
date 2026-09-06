import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlasmaConferenceForm } from "@/components/plasma-conference-form";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { boasConferidas, perdasEfetivas, podeConferirPlasma } from "@/lib/plasma-regras";
import { prisma } from "@/lib/prisma";

const statusNest: Record<string, string> = {
  PROGRAMADO: "Programado",
  EM_CORTE: "Em corte",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

function dataHora(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

function podeValidarLancamento(status: string) {
  return ["CONCLUIDO", "CANCELADO"].includes(status);
}

export default async function PlasmaConferenciaOpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id: idRaw } = await params;
  const opId = Number(idRaw);
  if (!Number.isInteger(opId) || opId < 1) notFound();

  const sp = await searchParams;
  const setorIdQr = Number(sp.setor);
  const pecaIdQr = Number(sp.peca);
  const usuario = await buscarOperadorLogado();
  if (!podeConferirPlasma(usuario)) redirect("/plasma/conferencia");

  const [op, setorPlasmaChapa] = await Promise.all([
    prisma.oP.findUnique({
      where: { id: opId },
      include: {
        modelo: {
          include: {
            pecas: { include: { peca: { select: { id: true, codigo: true, nome: true } } } },
          },
        },
      },
    }),
    prisma.setor.findFirst({ where: { nome: "Plasma Chapa" }, select: { id: true, nome: true } }),
  ]);
  if (!op || !setorPlasmaChapa) notFound();

  const setorValido = !Number.isInteger(setorIdQr) || setorIdQr < 1 || setorIdQr === setorPlasmaChapa.id;
  if (!setorValido) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 p-4 sm:p-6">
        <Link href="/plasma/conferencia" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para conferência</Link>
        <section className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">QR Code incompatível</p>
          <h1 className="mt-1 text-xl font-bold text-amber-100">Este QR Code não é do Plasma Chapa</h1>
          <p className="mt-2 text-sm text-amber-100/75">Leia o QR Code da etapa Plasma Chapa na OP. Os QR Codes de outros setores continuam no fluxo próprio deles.</p>
          <Link href="/plasma/conferencia/scanner" className="mt-4 block rounded-xl bg-amber-300 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-amber-200">Ler outro QR Code</Link>
        </section>
      </div>
    );
  }

  const itens = await prisma.nestItem.findMany({
    where: {
      opId,
      ...(Number.isInteger(pecaIdQr) && pecaIdQr > 0 ? { pecaId: pecaIdQr } : {}),
      nest: { setorId: setorPlasmaChapa.id },
    },
    include: {
      peca: { select: { id: true, codigo: true, nome: true, medida: true } },
      nest: { select: { id: true, codigo: true, status: true, maquina: { select: { codigo: true, nome: true } } } },
      lancamentos: {
        include: { funcionario: { select: { nome: true } }, conferente: { select: { nome: true } } },
        orderBy: { dataHora: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  const pecasSelecionadas = [...new Map(itens.map((item) => [item.peca.id, item.peca])).values()];
  const componenteQr = Number.isInteger(pecaIdQr) && pecaIdQr > 0
    ? op.modelo.pecas.find((item) => item.pecaId === pecaIdQr)
    : null;
  const quantidadeNecessaria = componenteQr
    ? op.quantidade * componenteQr.quantidadeNecessaria
    : op.modelo.pecas.filter((item) => pecasSelecionadas.some((peca) => peca.id === item.pecaId)).reduce((soma, item) => soma + op.quantidade * item.quantidadeNecessaria, 0);
  const totalPlanejado = itens.reduce((soma, item) => soma + item.quantidadePlanejada, 0);
  const lancamentos = itens.flatMap((item) => item.lancamentos);
  const totalDeclarado = lancamentos.reduce((soma, item) => soma + item.quantidadeBoa + item.quantidadeRefugo, 0);
  const totalLiberado = lancamentos.reduce((soma, item) => soma + boasConferidas(item), 0);
  const totalPerdas = lancamentos.reduce((soma, item) => soma + perdasEfetivas(item), 0);
  const pendentes = lancamentos.filter((item) => item.apontamentoId === null);
  const conferidos = lancamentos.length - pendentes.length;

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-4 sm:p-6">
      <header>
        <Link href="/plasma/conferencia" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para conferência</Link>
        <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Conferência móvel · Plasma Chapa</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">OP {op.numeroSequencia}</h1>
            <p className="mt-1 text-sm text-slate-300">Lote: <strong className="text-white">{op.lote ?? "Sem lote"}</strong> · {op.modelo.codigo}{op.modelo.nome ? ` · ${op.modelo.nome}` : ""}</p>
          </div>
          <span className="rounded border border-amber-300/35 bg-amber-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-100">{pendentes.length ? "Pendente" : "Conferida"}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">Peça(s): {pecasSelecionadas.length ? pecasSelecionadas.map((peca) => peca.codigo).join(" · ") : "Nenhuma peça encontrada"}</p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Resumo titulo="Necessária" valor={quantidadeNecessaria || totalPlanejado} />
        <Resumo titulo="Planejada" valor={totalPlanejado} />
        <Resumo titulo="Liberada" valor={totalLiberado} cor="text-emerald-200" />
        <Resumo titulo="A conferir" valor={pendentes.length} cor="text-amber-200" />
      </section>

      <section className="rounded-xl border border-amber-400/25 bg-[#202a36] shadow-lg shadow-black/10">
        <div className="border-b border-amber-400/15 px-4 py-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">Rastreabilidade do corte</p>
          <h2 className="mt-1 text-lg font-bold text-amber-100">NESTs e lançamentos da OP</h2>
          <p className="mt-1 text-sm text-slate-400">Cada confirmação gera o apontamento oficial do corte para o restante da fábrica.</p>
        </div>
        <div className="space-y-3 p-3 sm:p-4">
          {itens.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/25 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold text-cyan-100">{item.nest.codigo}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.peca.codigo}{item.peca.medida ? ` · ${item.peca.medida}` : ""} · {item.nest.maquina.codigo}</p>
                </div>
                <span className="rounded border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{statusNest[item.nest.status] ?? item.nest.status}</span>
              </div>
              <div className="mt-3 rounded-lg border border-slate-700/80 bg-[#111925] p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Planejado</span>
                  <strong className="text-white">{numero(item.quantidadePlanejada)} peças</strong>
                </div>
              </div>
              {item.lancamentos.length ? item.lancamentos.map((lancamento) => {
                const totalLancamento = lancamento.quantidadeBoa + lancamento.quantidadeRefugo;
                const confirmado = lancamento.apontamentoId !== null;
                return (
                  <div key={lancamento.id} className={`mt-3 rounded-xl border p-3 ${confirmado ? "border-emerald-400/25 bg-emerald-400/5" : "border-amber-400/25 bg-amber-400/5"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{lancamento.funcionario.nome}</p>
                        <p className="mt-1 text-xs text-slate-500">Declarado em {dataHora(lancamento.dataHora)}</p>
                      </div>
                      <div className="text-right text-sm"><strong className="text-sky-200">{lancamento.quantidadeBoa}</strong> boas · <strong className="text-rose-200">{lancamento.quantidadeRefugo}</strong> perdas</div>
                    </div>
                    {confirmado ? (
                      <p className="mt-3 border-t border-emerald-400/15 pt-3 text-xs font-bold uppercase tracking-wide text-emerald-200">Confirmado por {lancamento.conferente?.nome ?? "conferente"}{lancamento.conferidoEm ? ` · ${dataHora(lancamento.conferidoEm)}` : ""}</p>
                    ) : podeValidarLancamento(item.nest.status) ? (
                      <PlasmaConferenceForm lancamentoId={lancamento.id} quantidadeBoa={lancamento.quantidadeBoa} quantidadeRefugo={lancamento.quantidadeRefugo} />
                    ) : (
                      <p className="mt-3 border-t border-amber-400/15 pt-3 text-xs text-amber-200">Aguardando o encerramento do NEST para liberar a conferência.</p>
                    )}
                    {lancamento.motivoRefugo && <p className="mt-2 text-xs text-slate-500">Observação da perda: {lancamento.motivoRefugo}</p>}
                    {lancamento.apontamentoId === null && totalLancamento === 0 && <p className="mt-2 text-xs text-rose-200">Lançamento sem quantidade informada.</p>}
                  </div>
                );
              }) : <p className="mt-3 rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">Nenhum lançamento registrado neste NEST.</p>}
            </article>
          ))}
          {!itens.length && <div className="rounded-lg border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">Não há NESTs cadastrados para esta OP e peça no Plasma Chapa.</div>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-[#202a36] p-4 text-xs text-slate-400">
        <div className="flex flex-wrap justify-between gap-2"><span>Declarado: <strong className="text-slate-200">{numero(totalDeclarado)}</strong></span><span>Conferido: <strong className="text-emerald-200">{numero(conferidos)}</strong> lançamento(s)</span><span>Perdas: <strong className="text-rose-200">{numero(totalPerdas)}</strong></span></div>
      </section>
    </div>
  );
}

function Resumo({ titulo, valor, cor = "text-slate-100" }: { titulo: string; valor: number; cor?: string }) {
  return <div className="rounded-xl border border-slate-700 bg-[#202a36] px-3 py-2.5"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-1 text-lg font-bold ${cor}`}>{numero(valor)}</p></div>;
}
