import Link from "next/link";
import { notFound } from "next/navigation";
import { refazerNest, registrarEventoNest, registrarLancamentoNest } from "@/lib/actions/nests";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

const statusLabel: Record<string, string> = { PROGRAMADO: "Programado", EM_CORTE: "Em corte", PAUSADO: "Pausado", CONCLUIDO: "Concluído", CANCELADO: "Cancelado" };
const eventoLabel: Record<string, string> = { PROGRAMADO: "Programação criada", INICIO: "Corte iniciado", PAUSA: "Corte pausado", RETORNO: "Corte retomado", FIM: "Corte concluído", CANCELAMENTO: "Nest cancelado" };

function dataHora(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

function valor(numero: number | null, sufixo = "") {
  return numero === null ? "-" : `${numero.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${sufixo}`;
}

function tempo(segundos: number | null) {
  if (segundos === null) return "-";
  return [Math.floor(segundos / 3600), Math.floor((segundos % 3600) / 60), segundos % 60].map((item) => String(item).padStart(2, "0")).join(":");
}

export default async function NestDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await params;
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
          include: {
            op: { select: { id: true, lote: true, modelo: { select: { codigo: true, nome: true } } } },
            peca: { select: { codigo: true, nome: true, medida: true } },
            lancamentos: { include: { funcionario: { select: { nome: true } } }, orderBy: { dataHora: "desc" } },
          },
          orderBy: { id: "asc" },
        },
        eventos: { include: { funcionario: { select: { nome: true } } }, orderBy: { dataHora: "desc" } },
      },
    }),
  ]);
  if (!nest) notFound();

  const usuarioNoPlasma = Boolean(usuario && (usuario.administrador || usuario.papel !== "OPERADOR" || usuario.setorId === nest.setor.id));
  const setorEhPlasma = ehSetor(nest.setor.nome, "Plasma Chapa") || ehSetor(nest.setor.nome, "Plasma Tubo");
  const podeOperar = usuarioNoPlasma && setorEhPlasma;
  const emAberto = !["CONCLUIDO", "CANCELADO"].includes(nest.status);
  const totalPlanejado = nest.itens.reduce((total, item) => total + item.quantidadePlanejada, 0);
  const totalBom = nest.itens.reduce((total, item) => total + item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeBoa, 0), 0);
  const quantidadeParaRefazer = Math.max(0, totalPlanejado - totalBom);
  const totalRefugo = nest.itens.reduce((total, item) => total + item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeRefugo, 0), 0);
  const todosLancamentos = nest.itens.flatMap((item) => item.lancamentos).sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
  const ultimoLancamento = todosLancamentos[0] ?? null;
  const apontadores = [...new Set(todosLancamentos.map((lancamento) => lancamento.funcionario.nome))];
  const eventoConclusao = nest.eventos.find((evento) => evento.tipo === "FIM") ?? null;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/plasma" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para Plasma</Link>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Criado em {dataHora(nest.createdAt)}</span>
      </div>

      <section className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-[#1a3142] via-[#1d2a38] to-[#202a36] p-5 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Rastreabilidade de corte</p>
            <h2 className="mt-1 font-mono text-2xl font-bold tracking-wide text-white">{nest.codigo}</h2>
            <p className="mt-1 text-sm text-slate-300">{nest.setor.nome} · {nest.maquina.codigo} - {nest.maquina.nome} · Programador: {nest.programador.nome}</p>
            {nest.arquivoPdfUrl && <a href={nest.arquivoPdfUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">Abrir PDF original do Libellula ↗</a>}
          </div>
          <span className="rounded border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-cyan-100">{statusLabel[nest.status] ?? nest.status}</span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-9">
          <Dado titulo="Planejado" valor={String(totalPlanejado)} />
          <Dado titulo="Boas" valor={String(totalBom)} cor="text-emerald-200" />
          <Dado titulo="A refazer" valor={String(Math.max(0, totalPlanejado - totalBom))} cor="text-amber-200" />
          <Dado titulo="Perdas" valor={String(totalRefugo)} cor="text-rose-200" />
          <Dado titulo="Chapas" valor={String(nest.quantidadeChapas)} />
          <Dado titulo="Aproveitamento" valor={valor(nest.aproveitamentoPct, "%")} />
          <Dado titulo="Tempo de corte" valor={tempo(nest.tempoCorteSegundos)} />
          <Dado titulo="Último apontamento" valor={ultimoLancamento ? `${ultimoLancamento.funcionario.nome} · ${dataHora(ultimoLancamento.dataHora)}` : "Nenhum ainda"} cor={ultimoLancamento ? "text-cyan-100" : "text-slate-500"} />
          <Dado titulo="Concluído por" valor={eventoConclusao ? `${eventoConclusao.funcionario.nome} · ${dataHora(eventoConclusao.dataHora)}` : "Ainda aberto"} cor={eventoConclusao ? "text-emerald-200" : "text-slate-500"} />
        </div>
        {apontadores.length > 0 && <p className="mt-2 text-xs text-slate-400">Apontamentos registrados por: <span className="text-slate-200">{apontadores.join(", ")}</span></p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
            <div className="border-b border-slate-700/80 px-4 py-3"><h3 className="text-sm font-semibold text-slate-100">Peças e baixas do nest</h3><p className="mt-0.5 text-xs text-slate-500">Produção, perda e retrabalho são registrados por OP e por peça.</p></div>
            <div className="divide-y divide-slate-700/70">
              {nest.itens.map((item) => {
                const boas = item.lancamentos.reduce((total, lancamento) => total + lancamento.quantidadeBoa, 0);
                const refugo = item.lancamentos.reduce((total, lancamento) => total + lancamento.quantidadeRefugo, 0);
                const retrabalho = item.lancamentos.reduce((total, lancamento) => total + (lancamento.tipo === "RETRABALHO" ? lancamento.quantidadeBoa + lancamento.quantidadeRefugo : 0), 0);
                return (
                  <article key={item.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-bold text-white">{item.peca.codigo}</p>
                        <p className="mt-0.5 text-xs text-slate-400">OP {item.op.lote ?? `#${item.op.id}`} · {item.op.modelo.codigo} · {item.peca.nome}{item.peca.medida ? ` (${item.peca.medida})` : ""}</p>
                      </div>
                      <div className="flex gap-2 text-center text-xs"><Resumo titulo="Plano" valor={item.quantidadePlanejada} /><Resumo titulo="Boa" valor={boas} cor="text-emerald-200" /><Resumo titulo="Falta" valor={Math.max(0, item.quantidadePlanejada - boas)} cor="text-amber-200" /><Resumo titulo="Perda" valor={refugo} cor="text-rose-200" /><Resumo titulo="Retrab." valor={retrabalho} cor="text-amber-200" /></div>
                    </div>

                    {podeOperar && nest.status === "EM_CORTE" && (
                      <form action={registrarLancamentoNest} className="mt-4 grid gap-2 rounded-lg border border-slate-700/80 bg-slate-950/25 p-3 sm:grid-cols-2 lg:grid-cols-[6rem_6rem_9rem_minmax(0,1fr)_auto]">
                        <input type="hidden" name="nestItemId" value={item.id} />
                        <label><span className={labelClass}>Boa</span><input name="quantidadeBoa" type="number" min="0" defaultValue="0" className={inputClass} /></label>
                        <label><span className={labelClass}>Perda</span><input name="quantidadeRefugo" type="number" min="0" defaultValue="0" className={inputClass} /></label>
                        <label><span className={labelClass}>Lançamento</span><select name="tipo" className={inputClass}><option value="PRODUCAO">Produção</option><option value="RETRABALHO">Retrabalho</option></select></label>
                        <label><span className={labelClass}>Motivo / observação</span><input name="motivoRefugo" placeholder="Ex.: peça danificada, refeito" className={inputClass} /></label>
                        <button type="submit" className="self-end rounded bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300">Baixar</button>
                      </form>
                    )}

                    {item.lancamentos.length > 0 && (
                      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[540px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-1 font-medium">Quando</th><th className="pb-1 font-medium">Operador</th><th className="pb-1 font-medium">Tipo</th><th className="pb-1 font-medium">Boa</th><th className="pb-1 font-medium">Perda</th><th className="pb-1 font-medium">Observação</th></tr></thead><tbody className="text-slate-300">{item.lancamentos.map((lancamento) => <tr key={lancamento.id} className="border-t border-slate-700/50"><td className="py-1.5 text-slate-500">{dataHora(lancamento.dataHora)}</td><td>{lancamento.funcionario.nome}</td><td>{lancamento.tipo === "RETRABALHO" ? "Retrabalho" : "Produção"}</td><td className="text-emerald-200">{lancamento.quantidadeBoa}</td><td className="text-rose-200">{lancamento.quantidadeRefugo}</td><td className="max-w-56 truncate text-slate-400">{lancamento.motivoRefugo ?? lancamento.observacao ?? "-"}</td></tr>)}</tbody></table></div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {!emAberto && (
            <section className="rounded-xl border border-amber-400/25 bg-[#202a36] shadow-lg shadow-black/10">
              <div className="border-b border-amber-400/20 px-4 py-3">
                <h3 className="text-sm font-semibold text-amber-100">Refazer este NEST</h3>
                <p className="mt-0.5 text-xs text-slate-400">Crie uma nova programação mantendo o NEST original e todo o histórico.</p>
              </div>
              <form action={refazerNest} className="space-y-3 p-4">
                <input type="hidden" name="nestId" value={nest.id} />
                <label className="block">
                  <span className={labelClass}>Motivo da refação</span>
                  <input name="motivo" placeholder="Ex.: perda de peças, erro de corte..." className={inputClass} />
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-300">
                  <input name="quantidade" type="checkbox" value="TOTAL" className="mt-0.5 accent-amber-300" />
                  <span>Refazer todas as quantidades originais</span>
                </label>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Sem marcar, serão programadas apenas as {quantidadeParaRefazer} peças ainda pendentes. {quantidadeParaRefazer === 0 && "Como não há pendências, marque a opção acima para repetir o corte completo."}
                </p>
                <button type="submit" className="w-full rounded bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-200">Gerar NEST de refação</button>
              </form>
            </section>
          )}

          <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
            <div className="border-b border-slate-700/80 px-4 py-3"><h3 className="text-sm font-semibold text-slate-100">Dados técnicos da programação</h3></div>
            <dl className="grid gap-px bg-slate-700/70 sm:grid-cols-2 lg:grid-cols-4">{[
              ["Arquivo", nest.nomeArquivo ?? "-"], ["Material", nest.material], ["Espessura", valor(nest.espessuraMm, " mm")], ["Chapa", nest.larguraChapaMm === null || nest.alturaChapaMm === null ? "-" : `${valor(nest.larguraChapaMm)} × ${valor(nest.alturaChapaMm)} mm`],
              ["Peso da chapa", valor(nest.pesoChapaKg, " kg")], ["Peso das peças", valor(nest.pesoPecasKg, " kg")], ["Sobra", valor(nest.pesoSobraKg, " kg")], ["Perfurações", valor(nest.numeroPiercings)],
              ["Comprimento de corte", valor(nest.comprimentoCorteMm, " mm")], ["Movimento rápido", valor(nest.comprimentoRapidoMm, " mm")], ["Tempo de deslocamento", tempo(nest.tempoDeslocamentoSegundos)], ["Início", nest.iniciadoEm ? dataHora(nest.iniciadoEm) : "-"],
            ].map(([chave, conteudo]) => <div key={String(chave)} className="bg-[#202a36] px-3 py-2.5"><dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{chave}</dt><dd className="mt-1 text-xs font-semibold text-slate-200">{conteudo}</dd></div>)}</dl>
            {nest.observacao && <p className="border-t border-slate-700/80 px-4 py-3 text-xs text-slate-400">{nest.observacao}</p>}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
            <div className="border-b border-slate-700/80 px-4 py-3"><h3 className="text-sm font-semibold text-slate-100">Operação da máquina</h3></div>
            <div className="p-4">
              {podeOperar && emAberto ? (
                <form action={registrarEventoNest} className="space-y-3">
                  <input type="hidden" name="nestId" value={nest.id} />
                  <label className="block"><span className={labelClass}>Observação do evento</span><input name="descricao" placeholder="Motivo da pausa, troca de chapa..." className={inputClass} /></label>
                  <div className="grid grid-cols-2 gap-2">
                    {nest.status === "PROGRAMADO" && <BotaoEvento tipo="INICIO" texto="Iniciar corte" className="col-span-2 bg-emerald-400 text-slate-950 hover:bg-emerald-300" />}
                    {nest.status === "EM_CORTE" && <><BotaoEvento tipo="PAUSA" texto="Pausar" className="border border-amber-400/40 text-amber-200 hover:bg-amber-400/10" /><BotaoEvento tipo="FIM" texto="Concluir nest" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" /></>}
                    {nest.status === "PAUSADO" && <><BotaoEvento tipo="RETORNO" texto="Retomar" className="border border-emerald-400/40 text-emerald-200 hover:bg-emerald-400/10" /><BotaoEvento tipo="FIM" texto="Concluir nest" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" /></>}
                  </div>
                </form>
              ) : <p className="text-xs text-slate-500">{emAberto ? "Seu acesso não permite operar este nest." : "Este nest está encerrado; sua rastreabilidade permanece disponível."}</p>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
            <div className="border-b border-slate-700/80 px-4 py-3"><h3 className="text-sm font-semibold text-slate-100">Linha do tempo</h3></div>
            <ol className="space-y-4 p-4">{nest.eventos.map((evento) => <li key={evento.id} className="relative border-l border-cyan-400/30 pl-4 before:absolute before:-left-1 before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-cyan-300"><p className="text-xs font-semibold text-slate-200">{eventoLabel[evento.tipo] ?? evento.tipo}</p><p className="mt-0.5 text-[11px] text-slate-500">{dataHora(evento.dataHora)} · {evento.funcionario.nome}</p>{evento.descricao && <p className="mt-1 text-xs text-slate-400">{evento.descricao}</p>}</li>)}</ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Dado({ titulo, valor, cor = "text-slate-100" }: { titulo: string; valor: string; cor?: string }) { return <div className="rounded border border-white/5 bg-slate-950/30 px-2.5 py-2"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-1 text-sm font-bold ${cor}`}>{valor}</p></div>; }
function Resumo({ titulo, valor, cor = "text-slate-200" }: { titulo: string; valor: number; cor?: string }) { return <div className="rounded border border-slate-700 bg-slate-950/25 px-2 py-1"><p className="font-mono text-[8px] uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-0.5 font-bold ${cor}`}>{valor}</p></div>; }
function BotaoEvento({ tipo, texto, className }: { tipo: string; texto: string; className: string }) { return <button type="submit" name="tipo" value={tipo} className={`rounded px-2.5 py-2 text-xs font-bold transition ${className}`}>{texto}</button>; }
const inputClass = "mt-1 w-full rounded border border-slate-700 bg-[#111925] px-2.5 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30";
const labelClass = "font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500";

