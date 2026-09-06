import Link from "next/link";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { buscarDemandaPlasma } from "@/lib/plasma-saldo";
import { ehSetor } from "@/lib/setores";
import { prisma } from "@/lib/prisma";

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

function indicador({ titulo, valor, detalhe, cor }: { titulo: string; valor: number; detalhe: string; cor: string }) {
  return (
    <article className="rounded-xl border border-slate-700 bg-[#162130] p-4 shadow-lg shadow-black/10">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{titulo}</p>
      <p className={`mt-2 text-3xl font-black ${cor}`}>{numero(valor)}</p>
      <p className="mt-1 text-xs text-slate-400">{detalhe}</p>
    </article>
  );
}

function resumo(titulo: string, valor: number, detalhe: string, cor = "text-slate-100") {
  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-950/20 px-3 py-3">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`mt-1 text-xl font-bold ${cor}`}>{numero(valor)}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{detalhe}</p>
    </div>
  );
}

export default async function PlasmaReposicaoPage() {
  const usuario = await buscarOperadorLogado();
  const setores = (await prisma.setor.findMany({ select: { id: true, nome: true } }))
    .filter((setor) => ehSetor(setor.nome, "Plasma Chapa") || ehSetor(setor.nome, "Plasma Tubo"));
  const setorPlasmaChapa = setores.find((setor) => ehSetor(setor.nome, "Plasma Chapa"));
  const setorIds = setores.map((setor) => setor.id);
  const demanda = await buscarDemandaPlasma();
  const demandasChapa = demanda.filter((item) => item.setorId === setorPlasmaChapa?.id);
  const reposicoes = demandasChapa.filter((item) => item.reposicao > 0);
  const demandasComFalta = demandasChapa.filter((item) => item.perdas > 0);
  const reposicaoNests = setorPlasmaChapa
    ? await prisma.nestCorte.findMany({
        where: { setorId: setorPlasmaChapa.id, refeitoDeId: { not: null } },
        select: {
          id: true,
          status: true,
          itens: {
            select: {
              quantidadePlanejada: true,
              lancamentos: {
                select: {
                  quantidadeBoa: true,
                  quantidadeRefugo: true,
                  apontamentoId: true,
                  quantidadeConferidaBoa: true,
                },
              },
            },
          },
        },
      })
    : [];

  const totalReposicao = reposicoes.reduce((soma, item) => soma + item.reposicao, 0);
  const totalReposicaoOperador = reposicoes.reduce((soma, item) => soma + item.reposicaoOperador, 0);
  const totalReposicaoConferente = reposicoes.reduce((soma, item) => soma + item.reposicaoConferente, 0);
  const totalPerdasIdentificadas = demandasComFalta.reduce((soma, item) => soma + item.perdas, 0);
  const opsComFalta = new Set(demandasComFalta.map((item) => item.opId)).size;
  const itensComFalta = demandasComFalta.length;
  const faltasConfirmadasPeloConferente = demandasComFalta.filter((item) => item.conferenteNotificou).length;
  const statusAtivo = new Set(["PROGRAMADO", "EM_CORTE", "PAUSADO"]);
  const nestsAtivos = reposicaoNests.filter((nest) => statusAtivo.has(nest.status));
  const totalEmProgramacao = nestsAtivos.reduce((somaNest, nest) => somaNest + nest.itens.reduce((somaItem, item) => {
    const declarado = item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeBoa + lancamento.quantidadeRefugo, 0);
    return somaItem + Math.max(0, item.quantidadePlanejada - declarado);
  }, 0), 0);
  const totalReposto = reposicaoNests.reduce((somaNest, nest) => somaNest + nest.itens.reduce((somaItem, item) => somaItem + item.lancamentos.reduce((soma, lancamento) => soma + (lancamento.apontamentoId === null ? 0 : lancamento.quantidadeConferidaBoa ?? lancamento.quantidadeBoa), 0), 0), 0);
  const totalAguardandoConferencia = reposicaoNests.reduce((somaNest, nest) => somaNest + nest.itens.reduce((somaItem, item) => somaItem + item.lancamentos.reduce((soma, lancamento) => soma + (lancamento.apontamentoId === null ? lancamento.quantidadeBoa + lancamento.quantidadeRefugo : 0), 0), 0), 0);
  const podeProgramar = Boolean(
    usuario && (usuario.administrador || usuario.papel === "PCP" || (["LIDER", "OPERADOR"].includes(usuario.papel) && setorIds.includes(usuario.setorId))),
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/plasma" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para o painel Plasma</Link>
          <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">Plasma · programação</p>
          <h1 className="mt-1 text-2xl font-bold uppercase text-white">REPOSIÇÃO</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">Visão rápida das faltas, reposições em andamento e peças já liberadas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeProgramar && <Link href="/plasma/novo?reposicao=1" className="rounded bg-rose-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-950 transition hover:bg-rose-200">Programar reposições</Link>}
          <Link href="/plasma" className="rounded border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Ver painel Plasma</Link>
        </div>
      </header>

      <section aria-labelledby="indicadores-reposicao">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300">Indicadores da reposição</p>
            <h2 id="indicadores-reposicao" className="mt-1 text-lg font-bold text-white">Situação atual do Plasma Chapa</h2>
          </div>
          <span className="text-xs text-slate-500">Atualizado com os lançamentos oficiais</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {indicador({ titulo: "A repor agora", valor: totalReposicao, detalhe: "peças pendentes", cor: "text-rose-200" })}
          {indicador({ titulo: "Já repostas", valor: totalReposto, detalhe: "peças liberadas", cor: "text-emerald-200" })}
          {indicador({ titulo: "Em programação", valor: totalEmProgramacao, detalhe: `${nestsAtivos.length} NEST(s) ativos`, cor: "text-sky-200" })}
          {indicador({ titulo: "OPs envolvidas", valor: opsComFalta, detalhe: `${itensComFalta} item(ns) com falta`, cor: "text-amber-200" })}
          {indicador({ titulo: "Perdas identificadas", valor: totalPerdasIdentificadas, detalhe: "operador + conferente", cor: "text-orange-200" })}
          {indicador({ titulo: "Aguardando conferência", valor: totalAguardandoConferencia, detalhe: "peças em NEST de reposição", cor: "text-violet-200" })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
          <header className="border-b border-slate-700/80 px-4 py-4 sm:px-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Leitura gerencial</p>
            <h2 className="mt-1 text-lg font-bold text-white">Origem e andamento das faltas</h2>
            <p className="mt-1 text-sm text-slate-400">A falta do operador e a diferença identificada pelo conferente permanecem separadas.</p>
          </header>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {resumo("Falta do operador", totalReposicaoOperador, "peças na fila atual", "text-amber-200")}
            {resumo("Falta do conferente", totalReposicaoConferente, "peças adicionais", "text-rose-200")}
            {resumo("Conferente também notificou", faltasConfirmadasPeloConferente, "itens sem duplicar reposição", "text-cyan-200")}
            {resumo("NESTs de reposição", reposicaoNests.length, `${nestsAtivos.length} ainda ativos`, "text-sky-200")}
          </div>
        </section>

        <section className="rounded-xl border border-rose-400/25 bg-[#202a36] shadow-lg shadow-black/10">
          <header className="border-b border-rose-400/15 px-4 py-4 sm:px-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300">Próxima ação</p>
            <h2 className="mt-1 text-lg font-bold text-rose-100">Programar reposições</h2>
          </header>
          <div className="p-4 sm:p-5">
            {reposicoes.length > 0 ? (
              <>
                <p className="text-sm leading-relaxed text-slate-300"><strong className="text-rose-200">{numero(totalReposicao)}</strong> peça(s) aguardam programação em <strong className="text-white">{numero(reposicoes.length)}</strong> item(ns) de OP.</p>
                <p className="mt-2 text-xs text-slate-500">A próxima programação pode reunir todas as faltas em um único NEST.</p>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-emerald-100">Nenhuma peça pendente de reposição no Plasma Chapa.</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-rose-400/25 bg-[#202a36] shadow-lg shadow-black/10" aria-labelledby="pecas-reposicao">
        <header className="border-b border-rose-400/15 px-4 py-4 sm:px-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300">Fila para programar</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="pecas-reposicao" className="text-lg font-bold text-rose-100">Peças para fazer a reposição</h2>
              <p className="mt-1 text-sm text-slate-400">Estas são as peças que ainda precisam ser cortadas novamente.</p>
            </div>
            <span className="text-sm font-semibold text-rose-200">{numero(totalReposicao)} a fazer</span>
          </div>
        </header>

        {reposicoes.length > 0 ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {reposicoes.map((item) => (
              <article key={`${item.setorId}:${item.referencia}`} className="rounded-xl border border-slate-700 bg-slate-950/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-cyan-100">{item.codigo}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{item.nome}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.opLabel}{item.medida ? ` · ${item.medida}` : ""}</p>
                  </div>
                  <div className="shrink-0 rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-right">
                    <strong className="block text-xl text-rose-200">{numero(item.reposicao)}</strong>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">a fazer</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
                  {item.reposicaoOperador > 0 && <span className="rounded border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-amber-100">Falta do operador: {numero(item.reposicaoOperador)}</span>}
                  {item.reposicaoConferente > 0 && <span className="rounded border border-rose-300/25 bg-rose-300/10 px-2 py-1 text-rose-100">Falta do conferente: {numero(item.reposicaoConferente)}</span>}
                  {item.conferenteNotificou && item.reposicaoOperador > 0 && item.reposicaoConferente === 0 && <span className="rounded border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-cyan-100">Conferente também notificou · sem duplicar</span>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-5 text-sm text-emerald-100">Nenhuma peça pendente de reposição no Plasma Chapa.</div>
        )}
      </section>

    </div>
  );
}
