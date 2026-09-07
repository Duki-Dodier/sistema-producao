import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { rotuloMaquina } from "@/lib/maquinas";
import { segundosEfetivos } from "@/lib/plasma-regras";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { TempoOperacao } from "@/components/tempo-operacao";
import { PlasmaEventForm, type FaltaNestItem } from "@/components/plasma-event-form";
import { PlasmaProductionForm } from "@/components/plasma-production-form";

const statusLabel: Record<string, string> = {
  PROGRAMADO: "Programado",
  EM_CORTE: "Em corte",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export default async function OperacaoPlasmaMobilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ finalizado?: string; repor?: string }>;
}) {
  const { id: idRaw } = await params;
  const filtros = await searchParams;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) notFound();

  const [usuario, nest] = await Promise.all([
    buscarOperadorLogado(),
    prisma.nestCorte.findUnique({
      where: { id },
      include: {
        setor: { select: { id: true, nome: true } },
        maquina: { select: { codigo: true, nome: true } },
        programador: { select: { nome: true } },
        itens: {
          orderBy: { id: "asc" },
          include: {
            op: { select: { numeroSequencia: true, lote: true, modelo: { select: { codigo: true } } } },
            peca: { select: { codigo: true, nome: true } },
            lancamentos: { select: { quantidadeBoa: true, quantidadeRefugo: true, apontamentoId: true, quantidadeConferidaBoa: true, quantidadeConferidaRefugo: true } },
          },
        },
        eventos: { select: { tipo: true, dataHora: true } },
      },
    }),
  ]);

  if (!nest) notFound();
  const acessoPlasma = Boolean(usuario && (usuario.administrador || usuario.papel === "PCP" || usuario.setorId === nest.setor.id));
  const setorPlasma = ehSetor(nest.setor.nome, "Plasma Chapa") || ehSetor(nest.setor.nome, "Plasma Tubo");
  if (!acessoPlasma || !setorPlasma) notFound();

  const planejado = nest.itens.reduce((total, item) => total + item.quantidadePlanejada, 0);
  const declarado = nest.itens.reduce((total, item) => total + item.lancamentos.reduce((soma, l) => soma + l.quantidadeBoa + l.quantidadeRefugo, 0), 0);
  const ops = [...new Map(nest.itens.map((item) => [item.op.numeroSequencia, item.op])).values()];
  const encerrado = ["CONCLUIDO", "CANCELADO"].includes(nest.status);
  const podeOperar = usuario?.papel !== "CONFERENTE";
  const tempoInicial = segundosEfetivos(nest.eventos);
  const plasmaChapa = ehSetor(nest.setor.nome, "Plasma Chapa");
  const faltas: FaltaNestItem[] = nest.itens.map((item) => {
    const boas = item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeBoa, 0);
    const perdas = item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeRefugo, 0);
    return {
      pecaCodigo: item.peca.codigo,
      pecaNome: item.peca.nome,
      opNumero: item.op.numeroSequencia,
      lote: item.op.lote,
      planejado: item.quantidadePlanejada,
      boas,
      perdas,
      falta: Math.max(0, item.quantidadePlanejada - boas - perdas),
    };
  });
  const proximoNest = filtros?.finalizado === "1"
    ? await prisma.nestCorte.findFirst({
        where: { setorId: nest.setor.id, maquinaId: nest.maquinaId, status: "PROGRAMADO" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          codigo: true,
          itens: {
            orderBy: { id: "asc" },
            select: { quantidadePlanejada: true, op: { select: { numeroSequencia: true, lote: true } } },
          },
        },
      })
    : null;

  return (
    <main className="min-h-full bg-[#07101f] px-3 py-4 text-slate-100 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-lg space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/plasma" className="text-xs font-semibold text-slate-400 hover:text-cyan-200">← Painel Plasma</Link>
        </div>

        {filtros?.finalizado === "1" && (
          <div role="status" className="rounded-2xl border border-emerald-300/35 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            <p className="font-bold">Corte finalizado com sucesso.</p>
            <p className="mt-1 text-xs text-emerald-100/75">O tempo foi encerrado e o registro ficou salvo na rastreabilidade. {Number(filtros.repor) > 0 ? `${filtros.repor} peça(s) foram enviadas à reposição.` : "Nenhuma peça ficou pendente."}</p>
          </div>
        )}

        {filtros?.finalizado === "1" && (
          <section className="rounded-2xl border border-cyan-300/35 bg-cyan-400/10 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">Próximo NEST</p>
            {proximoNest ? (
              <>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">{proximoNest.codigo}</p>
                    <p className="mt-1 text-xs text-cyan-100/75">{proximoNest.itens.length} peça(s) · {proximoNest.itens.reduce((total, item) => total + item.quantidadePlanejada, 0)} programada(s)</p>
                    <p className="mt-1 text-xs text-slate-400">{[...new Set(proximoNest.itens.map((item) => `OP ${item.op.numeroSequencia} · lote ${item.op.lote ?? "-"}`))].join("  |  ")}</p>
                  </div>
                  <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-100">Programado</span>
                </div>
                <Link href="/apontamentos/scanner?destino=plasma" className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-300">
                  Ler QR Code do próximo NEST
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-300">Não há outro NEST programado para esta máquina.</p>
                <Link href="/apontamentos/scanner?destino=plasma" className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-3 text-center text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20">
                  Ler QR Code de outro NEST
                </Link>
              </>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-[#1b3142] via-[#182735] to-[#111b2b] p-4 shadow-xl shadow-black/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Operação de corte</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">{nest.codigo}</h1>
              <p className="mt-1 text-sm text-slate-300">{nest.setor.nome} · {rotuloMaquina(nest.maquina.codigo, nest.maquina.nome)}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${nest.status === "EM_CORTE" ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200" : nest.status === "PAUSADO" ? "border-amber-300/40 bg-amber-300/10 text-amber-200" : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"}`}>
              {statusLabel[nest.status] ?? nest.status}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {ops.map((op) => <div key={op.numeroSequencia} className="rounded-xl border border-cyan-300/15 bg-slate-950/25 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">OP {op.numeroSequencia}</p><p className="mt-1 text-sm font-bold text-white">Lote {op.lote ?? "-"}</p><p className="mt-0.5 text-xs text-slate-400">{op.modelo.codigo}</p></div>)}
            <div className="rounded-xl border border-cyan-300/15 bg-slate-950/25 p-3"><p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">Programador</p><p className="mt-1 truncate text-sm font-bold text-white">{nest.programador.nome}</p><p className="mt-0.5 text-xs text-slate-400">{nest.quantidadeChapas} chapa(s)</p></div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <Resumo titulo="Programado" valor={statusLabel[nest.status] ?? nest.status} cor="text-cyan-100" />
          <Resumo titulo="Quantidade" valor={planejado} />
        </section>

        <section className="rounded-2xl border border-slate-700 bg-[#111b2b] p-4">
          <div className="flex items-end justify-between gap-3">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Tempo de corte</p><p className="mt-1 text-3xl font-black text-cyan-100"><TempoOperacao segundosIniciais={tempoInicial} rodando={nest.status === "EM_CORTE"} /></p></div>
            <p className="text-right text-xs text-slate-500">{declarado}/{planejado}<br />peças registradas</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${planejado ? Math.min(100, Math.round(declarado / planejado * 100)) : 0}%` }} /></div>
        </section>

        {!encerrado && <section className="rounded-2xl border border-amber-300/25 bg-[#111b2b] p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">Produção do corte</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">Informe nesta mesma tela quantas peças saíram boas e quantas foram perdidas.</p>
          {nest.status === "EM_CORTE" ? <div className="mt-3 space-y-3">{nest.itens.map((item) => {
            const itemDeclarado = item.lancamentos.reduce((soma, l) => soma + l.quantidadeBoa + l.quantidadeRefugo, 0);
            const itemRestante = Math.max(0, item.quantidadePlanejada - itemDeclarado);
            return <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/20 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{item.peca.codigo}</p><p className="mt-1 text-xs text-slate-400">OP {item.op.numeroSequencia} · lote {item.op.lote ?? "-"}</p></div><p className="shrink-0 text-right text-xs text-slate-400">Já apontado<br /><strong className="text-cyan-100">{itemDeclarado}/{item.quantidadePlanejada}</strong></p></div>{itemRestante > 0 ? <PlasmaProductionForm nestItemId={item.id} restante={itemRestante} /> : <p className="mt-3 border-t border-slate-700/70 pt-3 text-xs font-semibold text-emerald-200">Quantidade deste item completa.</p>}</div>;
          })}</div> : <p className="mt-3 rounded-xl border border-slate-700 bg-slate-950/20 p-3 text-xs text-slate-400">Inicie ou retome o corte para registrar as quantidades.</p>}
        </section>}

        {!encerrado && podeOperar && <section className="rounded-2xl border border-slate-700 bg-[#111b2b] p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Comando da máquina</p>
          <PlasmaEventForm
            nestId={nest.id}
            status={nest.status as "PROGRAMADO" | "EM_CORTE" | "PAUSADO"}
            podeFinalizar={declarado === planejado}
            quantidadePendente={Math.max(0, planejado - declarado)}
            faltas={faltas}
            plasmaChapa={plasmaChapa}
          />
        </section>}

        <section className="rounded-2xl border border-slate-700 bg-[#111b2b] p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Peças deste NEST</p>
          <div className="mt-3 divide-y divide-slate-700/70">{nest.itens.map((item) => { const feito = item.lancamentos.reduce((soma, l) => soma + l.quantidadeBoa + l.quantidadeRefugo, 0); return <div key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{item.peca.codigo}</p><p className="truncate text-xs text-slate-400">OP {item.op.numeroSequencia} · lote {item.op.lote ?? "-"}</p></div><strong className="shrink-0 text-sm text-cyan-100">{feito}/{item.quantidadePlanejada}</strong></div>; })}</div>
        </section>
      </div>
    </main>
  );
}

function Resumo({ titulo, valor, cor = "text-white" }: { titulo: string; valor: number | string; cor?: string }) {
  return <div className="rounded-xl border border-slate-700 bg-[#111b2b] p-3"><p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">{titulo}</p><p className={`mt-1 ${typeof valor === "number" ? "text-xl" : "text-base uppercase"} font-black ${cor}`}>{valor}</p></div>;
}
