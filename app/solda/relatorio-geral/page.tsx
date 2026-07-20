import Link from "next/link";
import { MiniBarChart } from "@/components/mini-bar-chart";
import { formatDate } from "@/lib/format";
import { periodoRelatorio, relatorioGeralSolda } from "@/lib/solda-relatorios";

const INPUT_CLS = "rounded border border-slate-700 bg-[#1A222C] px-3 py-2 text-sm text-slate-200 focus:border-[#3B82F6] focus:outline-none";
const numero = (valor: number, casas = 0) => valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export default async function RelatorioGeralSoldaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const periodo = periodoRelatorio(sp.inicio, sp.fim);
  const dados = await relatorioGeralSolda(periodo);
  const queryPdf = new URLSearchParams({ inicio: periodo.inicioInput, fim: periodo.fimInput }).toString();

  return (
    <div className="flex min-h-full w-full flex-col gap-6 bg-[#242D3C] p-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Relatório Geral da Solda</h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">Produtividade do setor, ranking, mix produzido e fila atual</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/solda/relatorio-geral/pdf?${queryPdf}`} target="_blank" className="inline-flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-red-500"><PdfIcon /> Gerar PDF</Link>
          <Link href="/solda/relatorio" className="rounded border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-blue-300 hover:bg-blue-500/20">Por soldador</Link>
          <Link href="/solda" className="rounded border border-slate-600 bg-[#2C3645] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-700">← Voltar à Solda</Link>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-white/5 bg-[#202A36] px-5 py-4">
        <DateField label="De" name="inicio" value={periodo.inicioInput} />
        <DateField label="Até" name="fim" value={periodo.fimInput} />
        <button type="submit" className="rounded bg-[#3B82F6] px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-blue-500">Atualizar relatório</button>
        <span className="pb-2 text-[10px] uppercase tracking-wider text-slate-500">{formatDate(periodo.inicio)} até {formatDate(periodo.fim)}</span>
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Peças soldadas" value={numero(dados.totalSoldado)} destaque />
        <Kpi label="Média / dia trabalhado" value={numero(dados.mediaDia, 1)} />
        <Kpi label="Dias com produção" value={String(dados.diasTrabalhados)} />
        <Kpi label="Soldadores ativos" value={String(dados.soldadoresAtivos)} />
        <Kpi label="OPs atendidas" value={String(dados.opsAtendidas)} />
        <Kpi label="Melhor dia" value={dados.melhorDia ? `${dados.melhorDia.label} · ${dados.melhorDia.quantidade}` : "—"} texto />
        <Kpi label="Pior dia trabalhado" value={dados.piorDia ? `${dados.piorDia.label} · ${dados.piorDia.quantidade}` : "—"} texto />
        <Kpi label="Aguardando solda agora" value={numero(dados.aguardandoSolda)} alerta />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Section title="Produção total por dia">
          {dados.dias.length ? <MiniBarChart data={dados.dias.map((item) => ({ label: item.label, value: item.quantidade }))} /> : <Empty text="Nenhuma produção no período." />}
        </Section>
        <div className="rounded-lg border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-[#202A36] p-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Resumo do fluxo</span>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Mini label="Recebidas no período" value={numero(dados.totalRecebido)} />
            <Mini label="Conversão no período" value={`${dados.conversao}%`} />
            <Mini label="OPs na fila atual" value={String(dados.opsAguardando)} />
            <Mini label="Código líder" value={dados.codigoMaisSoldado?.codigo ?? "—"} />
          </div>
          {dados.codigoMaisSoldado && <p className="mt-4 border-t border-white/5 pt-4 text-xs text-slate-400">{dados.codigoMaisSoldado.codigo}: <strong className="text-emerald-400">{dados.codigoMaisSoldado.soldadas}</strong> peças soldadas.</p>}
        </div>
      </div>

      <Section title={`Ranking de soldadores (${dados.ranking.length})`}>
        <Table headers={["Pos.", "Soldador", "Peças", "Dias", "Média/dia", "OPs", "Código principal", "Qtd. principal"]}>
          {dados.ranking.map((item, index) => <tr key={item.soldador} className="hover:bg-[#2C3645]"><Td>{index + 1}º</Td><Td strong>{item.soldador}</Td><Td right green>{item.soldadas}</Td><Td right>{item.dias}</Td><Td right>{numero(item.media, 1)}</Td><Td right>{item.ops}</Td><Td mono>{item.codigoPrincipal}</Td><Td right>{item.quantidadePrincipal}</Td></tr>)}
          {!dados.ranking.length && <tr><td colSpan={8}><Empty text="Sem produção no período." /></td></tr>}
        </Table>
      </Section>

      <Section title={`Códigos soldados (${dados.codigos.length})`}>
        <Table headers={["Código", "Descrição", "Peças soldadas", "Participação", "OPs", "Soldadores"]}>
          {dados.codigos.map((item) => <tr key={item.codigo} className="hover:bg-[#2C3645]"><Td mono strong>{item.codigo}</Td><Td muted>{item.nome ?? "—"}</Td><Td right green>{item.soldadas}</Td><Td right>{dados.totalSoldado ? `${Math.round(item.soldadas / dados.totalSoldado * 100)}%` : "0%"}</Td><Td right>{item.ops}</Td><Td right>{item.soldadores}</Td></tr>)}
          {!dados.codigos.length && <tr><td colSpan={6}><Empty text="Nenhum código soldado no período." /></td></tr>}
        </Table>
      </Section>

      <Section title={`Fila atual da Solda · ${dados.aguardandoSolda} peças em ${dados.opsAguardando} OPs`}>
        <Table headers={["OP", "Código", "Descrição", "Recebidas", "Soldadas", "Aguardando"]}>
          {dados.aguardandoPorOp.map((item) => <tr key={item.opId} className="hover:bg-[#2C3645]"><Td mono>{item.numero}</Td><Td mono strong>{item.codigo}</Td><Td muted>{item.nome ?? "—"}</Td><Td right>{item.recebido}</Td><Td right green>{item.soldado}</Td><Td right amber>{item.aguardando}</Td></tr>)}
          {!dados.aguardandoPorOp.length && <tr><td colSpan={6}><Empty text="Não há peças aguardando solda." /></td></tr>}
        </Table>
      </Section>
    </div>
  );
}

function DateField({ label, name, value }: { label: string; name: string; value: string }) { return <div className="flex flex-col gap-1.5"><label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</label><input type="date" name={name} defaultValue={value} className={INPUT_CLS} /></div>; }
function Kpi({ label, value, destaque = false, alerta = false, texto = false }: { label: string; value: string; destaque?: boolean; alerta?: boolean; texto?: boolean }) { return <div className="flex min-h-20 flex-col rounded-lg border border-white/5 bg-[#2C3645] px-4 py-3 shadow-lg"><span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</span><span className={`mt-1 ${texto ? "text-sm font-semibold" : "text-2xl font-light"} ${destaque ? "text-emerald-400" : alerta ? "text-amber-400" : "text-white"}`}>{value}</span></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded bg-[#1A222C]/70 p-3"><div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 font-mono text-lg font-bold text-white">{value}</div></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="overflow-hidden rounded-lg border border-white/5 bg-[#202A36]"><div className="border-b border-white/5 bg-[#1A222C] px-5 py-3"><h2 className="text-sm font-semibold text-slate-100">{title}</h2></div>{children}</section>; }
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="overflow-x-auto"><table className="w-full text-left text-[11px] text-slate-300"><thead><tr className="border-b border-white/5 bg-[#1A222C] text-slate-400">{headers.map((header, index) => <th key={header} className={`px-4 py-2.5 font-semibold ${index >= 2 ? "text-right" : ""}`}>{header}</th>)}</tr></thead><tbody className="divide-y divide-white/5">{children}</tbody></table></div>; }
function Td({ children, right = false, mono = false, strong = false, muted = false, green = false, amber = false }: { children: React.ReactNode; right?: boolean; mono?: boolean; strong?: boolean; muted?: boolean; green?: boolean; amber?: boolean }) { return <td className={`px-4 py-2.5 ${right ? "text-right" : ""} ${mono ? "font-mono" : ""} ${strong ? "font-semibold text-slate-100" : ""} ${muted ? "text-slate-400" : ""} ${green ? "font-bold text-emerald-400" : ""} ${amber ? "font-bold text-amber-400" : ""}`}>{children}</td>; }
function Empty({ text }: { text: string }) { return <p className="px-5 py-10 text-center text-sm text-slate-500">{text}</p>; }
function PdfIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5" strokeWidth={2}><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h4"/></svg>; }
