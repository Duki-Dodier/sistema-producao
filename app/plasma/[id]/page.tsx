import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Thumb } from "@/components/thumb";
import { TempoOperacao } from "@/components/tempo-operacao";
import { conferirLancamentoNest, registrarEventoNest, registrarLancamentoNest } from "@/lib/actions/nests";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { rotuloMaquina } from "@/lib/maquinas";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { boasConferidas, perdasEfetivas, podeConferirPlasma, segundosEfetivos } from "@/lib/plasma-regras";
import { buscarDemandaPlasma } from "@/lib/plasma-saldo";

const statusLabel: Record<string, string> = { PROGRAMADO: "Programado", EM_CORTE: "Em corte", PAUSADO: "Pausado", CONCLUIDO: "Concluído", CANCELADO: "Cancelado" };
const eventoLabel: Record<string, string> = { PROGRAMADO: "Programação criada", INICIO: "Corte iniciado", PAUSA: "Corte pausado", RETORNO: "Corte retomado", FIM: "Corte concluído", CANCELAMENTO: "Nest cancelado", CONFERENCIA: "Corte conferido" };

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

export default async function NestDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id: idRaw } = await params;
  const sp = await searchParams;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) notFound();

  const [usuario, nest, demanda] = await Promise.all([
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
            peca: { select: { codigo: true, nome: true, medida: true, imagemUrl: true } },
            lancamentos: { include: { funcionario: { select: { nome: true } }, conferente: { select: { nome: true } } }, orderBy: { dataHora: "desc" } },
          },
          orderBy: { id: "asc" },
        },
        eventos: { include: { funcionario: { select: { nome: true } } }, orderBy: { dataHora: "desc" } },
      },
    }),
    buscarDemandaPlasma(),
  ]);
  if (!nest) notFound();
  if (sp.origem === "qrcode" && !usuario) {
    const destino = `/plasma/${nest.id}?origem=qrcode`;
    redirect(`/login?redirect=${encodeURIComponent(destino)}`);
  }

  const usuarioNoPlasma = Boolean(usuario && (usuario.administrador || usuario.papel === "PCP" || usuario.setorId === nest.setor.id));
  const setorEhPlasma = ehSetor(nest.setor.nome, "Plasma Chapa") || ehSetor(nest.setor.nome, "Plasma Tubo");
  const podeOperar = usuarioNoPlasma && setorEhPlasma && usuario?.papel !== "CONFERENTE";
  const podeConferir = podeConferirPlasma(usuario);
  const emAberto = !["CONCLUIDO", "CANCELADO"].includes(nest.status);
  const totalPlanejado = nest.itens.reduce((total, item) => total + item.quantidadePlanejada, 0);
  const totalDeclarado = nest.itens.reduce((total, item) => total + item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeBoa, 0), 0);
  const totalProcessado = nest.itens.reduce((total, item) => total + item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeBoa + lancamento.quantidadeRefugo, 0), 0);
  const totalBom = nest.itens.reduce((total, item) => total + item.lancamentos.reduce((soma, lancamento) => soma + boasConferidas(lancamento), 0), 0);
  const quantidadeParaRefazer = demanda.filter(item => item.origens.some(origem => origem.id === nest.id)).reduce((total, item) => total + item.reposicao, 0);
  const totalRefugo = nest.itens.reduce((total, item) => total + item.lancamentos.reduce((soma, lancamento) => soma + perdasEfetivas(lancamento), 0), 0);
  const todosLancamentos = nest.itens.flatMap((item) => item.lancamentos).sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
  const apontadores = [...new Set(todosLancamentos.map((lancamento) => lancamento.funcionario.nome))];
  const eventoConclusao = nest.eventos.find((evento) => evento.tipo === "FIM") ?? null;
  const tempoEfetivo = segundosEfetivos(nest.eventos);
  const aguardandoConferencia = todosLancamentos.filter(lancamento => lancamento.apontamentoId === null).length;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/plasma" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para Plasma</Link>
          <a href={`/plasma/${nest.id}/pdf`} target="_blank" rel="noreferrer" className="rounded border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-400/20">PDF de corte ↗</a>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Criado em {dataHora(nest.createdAt)}</span>
      </div>

      <section className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-[#1a3142] via-[#1d2a38] to-[#202a36] p-5 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Rastreabilidade de corte</p>
            <h2 className="mt-1 font-mono text-2xl font-bold tracking-wide text-white">{nest.codigo}</h2>
            <p className="mt-1 text-sm text-slate-300">{nest.setor.nome} · {rotuloMaquina(nest.maquina.codigo, nest.maquina.nome)} · Programador: {nest.programador.nome}</p>
            {nest.arquivoPdfUrl && <a href={nest.arquivoPdfUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">Abrir PDF original do Libellula ↗</a>}
          </div>
          <span className={`rounded border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${aguardandoConferencia && nest.status === "CONCLUIDO" ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"}`}>{aguardandoConferencia && nest.status === "CONCLUIDO" ? "Aguardando conferência" : statusLabel[nest.status] ?? nest.status}</span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-8">
          <Dado titulo="Planejado" valor={String(totalPlanejado)} />
          <Dado titulo="Declarado" valor={String(totalDeclarado)} cor="text-sky-200" />
          <Dado titulo="Liberado" valor={String(totalBom)} cor="text-emerald-200" />
          <Dado titulo="A repor" valor={String(quantidadeParaRefazer)} cor="text-rose-200" />
          <Dado titulo="Perdas" valor={String(totalRefugo)} cor="text-rose-200" />
          <Dado titulo="Chapas" valor={String(nest.quantidadeChapas)} />
          <Dado titulo="Tempo previsto" valor={tempo(nest.tempoCorteSegundos)} />
          <Dado titulo="Tempo efetivo" valor="" conteudo={<TempoOperacao segundosIniciais={tempoEfetivo} rodando={nest.status === "EM_CORTE"} />} cor="text-cyan-100" />
          <Dado titulo="Concluído por" valor={eventoConclusao ? `${eventoConclusao.funcionario.nome} · ${dataHora(eventoConclusao.dataHora)}` : "Ainda aberto"} cor={eventoConclusao ? "text-emerald-200" : "text-slate-500"} />
        </div>
        {apontadores.length > 0 && <p className="mt-2 text-xs text-slate-400">Apontamentos registrados por: <span className="text-slate-200">{apontadores.join(", ")}</span></p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <section id="conferencia" className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
            <div className="border-b border-slate-700/80 px-4 py-3"><h3 className="text-sm font-semibold text-slate-100">Peças e baixas do nest</h3><p className="mt-0.5 text-xs text-slate-500">Produção, perda e retrabalho são registrados por OP e por peça.</p></div>
            <div className="divide-y divide-slate-700/70">
              {nest.itens.map((item) => {
                const declaradasBoas = item.lancamentos.reduce((total, lancamento) => total + lancamento.quantidadeBoa, 0);
                const declaradasTotal = item.lancamentos.reduce((total, lancamento) => total + lancamento.quantidadeBoa + lancamento.quantidadeRefugo, 0);
                const boas = item.lancamentos.reduce((total, lancamento) => total + boasConferidas(lancamento), 0);
                const refugo = item.lancamentos.reduce((total, lancamento) => total + perdasEfetivas(lancamento), 0);
                const retrabalho = item.lancamentos.reduce((total, lancamento) => total + (lancamento.tipo === "RETRABALHO" ? lancamento.quantidadeBoa + lancamento.quantidadeRefugo : 0), 0);
                return (
                  <article key={item.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {item.peca.imagemUrl && (
                          <a href={item.peca.imagemUrl} target="_blank" rel="noreferrer" title={`Abrir imagem da peça ${item.peca.codigo}`}>
                            <Thumb src={item.peca.imagemUrl} alt={`Imagem da peça ${item.peca.codigo}`} size={76} className="rounded-lg border-slate-600 bg-white p-1 object-contain" />
                          </a>
                        )}
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-bold text-white">{item.peca.codigo}</p>
                          <p className="mt-0.5 text-xs text-slate-400">OP {item.op.lote ?? `#${item.op.id}`} · {item.op.modelo.codigo} · {item.peca.nome}{item.peca.medida ? ` (${item.peca.medida})` : ""}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-center text-xs"><Resumo titulo="Plano" valor={item.quantidadePlanejada} /><Resumo titulo="Declarada" valor={declaradasBoas} cor="text-sky-200" /><Resumo titulo="Liberada" valor={boas} cor="text-emerald-200" /><Resumo titulo="A declarar" valor={Math.max(0, item.quantidadePlanejada - declaradasTotal)} cor="text-amber-200" /><Resumo titulo="Perda" valor={refugo} cor="text-rose-200" />{retrabalho > 0 && <Resumo titulo="Reposição" valor={retrabalho} cor="text-amber-200" />}</div>
                    </div>

                    {podeOperar && nest.status === "EM_CORTE" && (
                      <form action={registrarLancamentoNest} className="mt-4 grid gap-2 rounded-lg border border-slate-700/80 bg-slate-950/25 p-3 sm:grid-cols-2 lg:grid-cols-[6rem_6rem_9rem_minmax(0,1fr)_auto]">
                        <input type="hidden" name="nestItemId" value={item.id} />
                        <label><span className={labelClass}>Boa</span><input name="quantidadeBoa" type="number" min="0" defaultValue="0" className={inputClass} /></label>
                        <label><span className={labelClass}>Perda</span><input name="quantidadeRefugo" type="number" min="0" defaultValue="0" className={inputClass} /></label>
                        <label><span className={labelClass}>Lançamento</span><select name="tipo" className={inputClass}><option value="PRODUCAO">Produção</option><option value="RETRABALHO">Retrabalho</option></select></label>
                        <label><span className={labelClass}>Motivo / observação</span><input name="motivoRefugo" placeholder="Ex.: peça danificada, refeito" className={inputClass} /></label>
                        <button type="submit" className="self-end rounded bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300">Registrar resultado</button>
                      </form>
                    )}

                    {item.lancamentos.length > 0 && (
                      <div className="mt-3 space-y-2">{item.lancamentos.map((lancamento) => <div key={lancamento.id} className={`rounded border p-3 ${lancamento.apontamentoId === null ? "border-amber-400/25 bg-amber-400/5" : "border-emerald-400/20 bg-emerald-400/5"}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3 text-sm"><div><p className="font-semibold text-slate-200">{lancamento.funcionario.nome} · {dataHora(lancamento.dataHora)}</p><p className="mt-1 text-xs text-slate-500">{lancamento.tipo === "RETRABALHO" ? "Reposição" : "Produção"}{lancamento.motivoRefugo ? ` · ${lancamento.motivoRefugo}` : ""}</p></div><div className="text-right"><p><strong className="text-sky-200">{lancamento.quantidadeBoa}</strong> boas · <strong className="text-rose-200">{lancamento.quantidadeRefugo}</strong> perdas</p><p className={`mt-1 text-xs font-bold uppercase ${lancamento.apontamentoId === null ? "text-amber-200" : "text-emerald-200"}`}>{lancamento.apontamentoId === null ? "Aguardando conferência" : lancamento.conferente ? `Conferido por ${lancamento.conferente.nome}` : "Produção liberada (histórico)"}</p></div></div>
                        {podeConferir && !emAberto && lancamento.apontamentoId === null && <form action={conferirLancamentoNest} className="mt-3 grid gap-2 border-t border-amber-400/15 pt-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
                          <input type="hidden" name="lancamentoId" value={lancamento.id} />
                          <label><span className={labelClass}>Boas confirmadas</span><input name="quantidadeConferidaBoa" type="number" min="0" max={lancamento.quantidadeBoa + lancamento.quantidadeRefugo} defaultValue={lancamento.quantidadeBoa} required className={inputClass} /></label>
                          <label><span className={labelClass}>Motivo se houver diferença</span><input name="motivoConferencia" placeholder="Ex.: medida fora da tolerância" className={inputClass} /></label>
                          <button type="submit" className="self-end rounded bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-200">Conferir e liberar</button>
                        </form>}
                      </div>)}</div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {!emAberto && quantidadeParaRefazer > 0 && (
            <section className="rounded-xl border border-amber-400/25 bg-[#202a36] shadow-lg shadow-black/10">
              <div className="border-b border-amber-400/20 px-4 py-3">
                <h3 className="text-sm font-semibold text-amber-100">Reposição necessária</h3>
                <p className="mt-0.5 text-xs text-slate-400">As perdas entram na fila do programador para serem agrupadas com outras peças.</p>
              </div>
              <div className="p-4"><p className="text-sm text-slate-300"><strong className="text-amber-200">{quantidadeParaRefazer}</strong> peça(s) para repor.</p><Link href="/plasma/novo?reposicao=1" className="mt-3 block rounded bg-amber-300 px-3 py-2 text-center text-xs font-bold text-slate-950 transition hover:bg-amber-200">Abrir fila consolidada de reposição</Link></div>
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
              <div className="mb-4 rounded border border-white/5 bg-slate-950/30 p-3"><p className="text-xs uppercase tracking-wider text-slate-500">Tempo efetivo</p><p className="mt-1 text-2xl font-bold text-cyan-100"><TempoOperacao segundosIniciais={tempoEfetivo} rodando={nest.status === "EM_CORTE"} /></p><p className="mt-1 text-xs text-slate-500">{totalProcessado}/{totalPlanejado} peças classificadas</p></div>
              {podeOperar && emAberto ? (
                <form action={registrarEventoNest} className="space-y-3">
                  <input type="hidden" name="nestId" value={nest.id} />
                  <label className="block"><span className={labelClass}>Observação do evento</span><input name="descricao" placeholder="Motivo da pausa, troca de chapa..." className={inputClass} /></label>
                  <div className="grid grid-cols-2 gap-2">
                    {nest.status === "PROGRAMADO" && <BotaoEvento tipo="INICIO" texto="Iniciar corte" className="col-span-2 bg-emerald-400 text-slate-950 hover:bg-emerald-300" />}
                    {nest.status === "EM_CORTE" && <><BotaoEvento tipo="PAUSA" texto="Pausar" className="border border-amber-400/40 text-amber-200 hover:bg-amber-400/10" />{totalProcessado === totalPlanejado && <BotaoEvento tipo="FIM" texto="Concluir nest" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" />}</>}
                    {nest.status === "PAUSADO" && <><BotaoEvento tipo="RETORNO" texto="Retomar" className="border border-emerald-400/40 text-emerald-200 hover:bg-emerald-400/10" />{totalProcessado === totalPlanejado && <BotaoEvento tipo="FIM" texto="Concluir nest" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" />}</>}
                  </div>
                  {totalProcessado !== totalPlanejado && nest.status !== "PROGRAMADO" && <p className="text-xs text-amber-200">Classifique todas as {totalPlanejado} peças como boas ou perdas antes de concluir.</p>}
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

function Dado({ titulo, valor, conteudo, cor = "text-slate-100" }: { titulo: string; valor: string; conteudo?: React.ReactNode; cor?: string }) { return <div className="rounded border border-white/5 bg-slate-950/30 px-2.5 py-2"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-1 text-sm font-bold ${cor}`}>{conteudo ?? valor}</p></div>; }
function Resumo({ titulo, valor, cor = "text-slate-200" }: { titulo: string; valor: number; cor?: string }) { return <div className="rounded border border-slate-700 bg-slate-950/25 px-2 py-1"><p className="font-mono text-[8px] uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-0.5 font-bold ${cor}`}>{valor}</p></div>; }
function BotaoEvento({ tipo, texto, className }: { tipo: string; texto: string; className: string }) { return <button type="submit" name="tipo" value={tipo} className={`rounded px-2.5 py-2 text-xs font-bold transition ${className}`}>{texto}</button>; }
const inputClass = "mt-1 w-full rounded border border-slate-700 bg-[#111925] px-2.5 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30";
const labelClass = "font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500";
