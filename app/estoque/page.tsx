import Link from "next/link";
import { Boxes, CalendarDays, CheckCircle2, PackageCheck, Printer, Search } from "lucide-react";
import {
  formatarDataHoraEstoque,
  montarRelatorioEstoque,
} from "@/lib/estoque-relatorio";

const CAMPO =
  "rounded-md border border-white/10 bg-[#111a27] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-500";

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const relatorio = await montarRelatorioEstoque({
    codigo: sp.codigo,
    linha: sp.linha,
    inicio: sp.inicio,
    fim: sp.fim,
  });
  const query = new URLSearchParams();
  for (const chave of ["codigo", "linha", "inicio", "fim"] as const) {
    if (sp[chave]) query.set(chave, sp[chave]!);
  }
  const movimentosExibidos = relatorio.movimentos.slice(0, 150);
  const maiorDia = Math.max(...relatorio.dias.map((dia) => dia.quantidade), 1);

  return (
    <div className="min-h-full bg-[#202a36] p-3 sm:p-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Produto acabado</p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Estoque</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Recebimentos enviados pela Montagem, com rastreabilidade por código, lote, OP e data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/estoque/relatorio${query.size ? `?${query.toString()}` : ""}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500"
            >
              <Printer className="h-4 w-4" /> Imprimir relatório
            </Link>
            <Link
              href="/pintura-montagem?aba=estoque"
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-[#192331] px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/5"
            >
              <PackageCheck className="h-4 w-4" /> Receber da Montagem
            </Link>
          </div>
        </header>

        <section className="rounded-xl border border-white/8 bg-[#192331] p-4 shadow-lg shadow-black/10 sm:p-5">
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_1fr_1fr_auto] lg:items-end">
            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Código do produto
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input name="codigo" defaultValue={relatorio.filtros.codigo} placeholder="Ex.: AD1003" className={`${CAMPO} w-full pl-9`} />
              </div>
            </label>
            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Linha
              <select name="linha" defaultValue={relatorio.filtros.linha} className={CAMPO}>
                <option value="">Todas</option>
                <option value="BRUCKE">BRUCKE</option>
                <option value="REFORCEL">REFORCEL</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Entrada de
              <input type="date" name="inicio" defaultValue={relatorio.filtros.inicioInput} className={CAMPO} />
            </label>
            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Até
              <input type="date" name="fim" defaultValue={relatorio.filtros.fimInput} className={CAMPO} />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500">Filtrar</button>
              <Link href="/estoque" className="rounded-md border border-white/10 px-3 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-white/5 hover:text-white">Limpar</Link>
            </div>
          </form>
          {relatorio.periodoInvalido && (
            <p className="mt-3 rounded-md bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300">
              A data inicial não pode ser posterior à data final.
            </p>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi icon={Boxes} titulo="Entradas acumuladas" valor={relatorio.totalAcumulado} detalhe="Até a data final selecionada" cor="text-emerald-300" />
          <Kpi icon={CalendarDays} titulo="Entradas no período" valor={relatorio.totalPeriodo} detalhe={relatorio.filtros.inicio ? "Dentro do intervalo" : "Todo o histórico até a data"} cor="text-sky-300" />
          <Kpi icon={PackageCheck} titulo="Códigos recebidos" valor={relatorio.modelos} detalhe="Modelos com entrada registrada" cor="text-violet-300" />
          <Kpi icon={CheckCircle2} titulo="OPs finalizadas" valor={relatorio.opsFinalizadas} detalhe="Com entrada completa no Estoque" cor="text-cyan-300" />
          <Kpi icon={Boxes} titulo="Lotes rastreados" valor={relatorio.lotes} detalhe="Lotes distintos recebidos" cor="text-amber-300" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Secao titulo="Quantidade acumulada por código" descricao="Somatório de todas as entradas até a data final. Não desconta futuras saídas ou faturamento.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b border-white/8 text-left text-[10px] uppercase tracking-wide text-slate-500"><Th>Código</Th><Th>Descrição</Th><Th>Linha</Th><Th right>Quantidade</Th><Th right>OPs</Th><Th right>Lotes</Th><Th>Última entrada</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {relatorio.resumo.map((item) => (
                    <tr key={item.modeloId} className="hover:bg-white/[0.02]">
                      <Td mono><Link href={`/estoque?codigo=${encodeURIComponent(item.codigo)}&fim=${relatorio.filtros.fimInput}`} className="text-cyan-300 hover:text-cyan-200">{item.codigo}</Link></Td>
                      <Td muted>{item.nome ?? "—"}</Td>
                      <Td><Linha linha={item.linhaProduto} /></Td>
                      <Td right destaque>{item.quantidade}</Td>
                      <Td right>{item.ops}</Td><Td right>{item.lotes}</Td>
                      <Td>{formatarDataHoraEstoque(item.ultimaEntrada)}</Td>
                    </tr>
                  ))}
                  {relatorio.resumo.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Nenhuma entrada encontrada.</td></tr>}
                </tbody>
              </table>
            </div>
          </Secao>

          <Secao titulo="Ritmo de entradas — últimos 7 dias" descricao="Quantidade recebida por dia considerando os filtros atuais.">
            <div className="flex h-52 items-end gap-2 pt-5">
              {relatorio.dias.map((dia) => (
                <div key={dia.chave} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-xs font-bold text-slate-300">{dia.quantidade || "—"}</span>
                  <div className="flex h-32 w-full items-end rounded-md bg-white/[0.03] p-1">
                    <div className="w-full rounded-sm bg-gradient-to-t from-emerald-600 to-cyan-400" style={{ height: `${dia.quantidade ? Math.max((dia.quantidade / maiorDia) * 100, 8) : 2}%` }} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">{dia.label}</span>
                </div>
              ))}
            </div>
          </Secao>
        </div>

        <Secao
          titulo={relatorio.filtros.codigo ? `Lotes e entradas de ${relatorio.filtros.codigo}` : "Histórico de entradas no Estoque"}
          descricao={relatorio.filtros.codigo ? "Cada recebimento parcial aparece separado para garantir a rastreabilidade." : "Use o filtro de código para consultar todos os lotes de um produto."}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead><tr className="border-b border-white/8 text-left text-[10px] uppercase tracking-wide text-slate-500"><Th>Data</Th><Th>Código</Th><Th>Lote</Th><Th>OP</Th><Th right>Entrada</Th><Th right>Recebido / OP</Th><Th>Progresso</Th><Th>Situação</Th><Th>Responsável</Th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {movimentosExibidos.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02]">
                    <Td>{formatarDataHoraEstoque(item.dataHora)}</Td>
                    <Td mono>{item.op.modelo.codigo}</Td>
                    <Td mono>{item.op.lote ?? "—"}</Td>
                    <Td mono>{item.op.numeroSequencia}</Td>
                    <Td right destaque>+{item.quantidade}</Td>
                    <Td right>{item.totalRecebidoNaOp} / {item.op.quantidade}</Td>
                    <Td><Progresso valor={item.percentualOp} /></Td>
                    <Td>{item.op.status === "CONCLUIDA" ? <span className="text-xs font-bold text-emerald-300">FINALIZADA</span> : <span className="text-xs font-bold text-amber-300">PARCIAL</span>}</Td>
                    <Td muted>{item.usuario}</Td>
                  </tr>
                ))}
                {movimentosExibidos.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Nenhuma movimentação encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
          {relatorio.movimentos.length > movimentosExibidos.length && (
            <p className="border-t border-white/5 px-4 py-3 text-xs text-slate-500">Exibindo as 150 entradas mais recentes. O relatório impresso contém todas as movimentações filtradas.</p>
          )}
        </Secao>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm leading-6 text-slate-300">
          <b className="text-emerald-300">Regra de conclusão da OP:</b> a Montagem pode enviar quantidades parciais. A OP permanece aberta enquanto houver saldo e é finalizada automaticamente quando o total recebido pelo Estoque atingir a quantidade planejada.
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, titulo, valor, detalhe, cor }: { icon: typeof Boxes; titulo: string; valor: number; detalhe: string; cor: string }) {
  return <div className="rounded-xl border border-white/8 bg-[#192331] p-4 shadow-lg shadow-black/10"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{titulo}</p><p className={`mt-2 text-3xl font-bold ${cor}`}>{valor}</p><p className="mt-1 text-xs text-slate-400">{detalhe}</p></div><Icon className={`h-5 w-5 ${cor}`} /></div></div>;
}
function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-white/8 bg-[#192331] shadow-lg shadow-black/10"><div className="border-b border-white/8 bg-[#151e2b] px-4 py-3 sm:px-5"><h2 className="text-sm font-bold text-slate-100">{titulo}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{descricao}</p></div>{children}</section>;
}
function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) { return <th className={`px-4 py-3 font-bold ${right ? "text-right" : ""}`}>{children}</th>; }
function Td({ children, right = false, mono = false, muted = false, destaque = false }: { children: React.ReactNode; right?: boolean; mono?: boolean; muted?: boolean; destaque?: boolean }) { return <td className={`px-4 py-3 ${right ? "text-right" : ""} ${mono ? "font-mono font-semibold" : ""} ${muted ? "text-slate-400" : "text-slate-300"} ${destaque ? "font-bold text-emerald-300" : ""}`}>{children}</td>; }
function Linha({ linha }: { linha: string }) { return <span className={`rounded px-2 py-1 text-[10px] font-bold ${linha === "REFORCEL" ? "bg-violet-500/15 text-violet-300" : "bg-blue-500/15 text-blue-300"}`}>{linha}</span>; }
function Progresso({ valor }: { valor: number }) { return <div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/5"><div className={`h-full ${valor >= 100 ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${valor}%` }} /></div><span className="text-xs font-bold text-slate-400">{valor}%</span></div>; }
