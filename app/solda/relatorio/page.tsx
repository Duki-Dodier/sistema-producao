import Link from "next/link";
import { MiniBarChart } from "@/components/mini-bar-chart";
import { formatDate } from "@/lib/format";
import {
  listarSoldadoresDaSolda,
  periodoRelatorio,
  relatorioDoSoldador,
} from "@/lib/solda-relatorios";

const INPUT_CLS =
  "rounded border border-slate-700 bg-[#1A222C] px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-[#3B82F6] focus:outline-none transition-colors";

const numero = (valor: number, casas = 0) =>
  valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

export default async function RelatorioSoldadorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const soldador = (sp.soldador ?? "").trim();
  const periodo = periodoRelatorio(sp.inicio, sp.fim);
  const [soldadores, relatorio] = await Promise.all([
    listarSoldadoresDaSolda(),
    soldador ? relatorioDoSoldador(soldador, periodo) : Promise.resolve(null),
  ]);
  const queryPdf = new URLSearchParams({
    soldador,
    inicio: periodo.inicioInput,
    fim: periodo.fimInput,
  }).toString();

  return (
    <div className="flex min-h-full w-full flex-col gap-6 bg-[#242D3C] p-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Relatório por Soldador</h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Produção, produtividade, códigos e OPs atendidas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {relatorio && (
            <Link
              href={`/solda/relatorio/pdf?${queryPdf}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-500"
            >
              <PdfIcon /> Gerar PDF
            </Link>
          )}
          <Link
            href="/solda/relatorio-geral"
            className="rounded border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-blue-300 transition-colors hover:bg-blue-500/20"
          >
            Relatório geral
          </Link>
          <Link
            href="/solda"
            className="rounded border border-slate-600 bg-[#2C3645] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-200 transition-colors hover:bg-slate-700"
          >
            ← Voltar à Solda
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-white/5 bg-[#202A36]">
        <form method="get" className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Soldador</label>
            <select name="soldador" required defaultValue={soldador} className={`w-52 ${INPUT_CLS}`}>
              <option value="" disabled>Selecione o soldador...</option>
              {soldadores.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
            </select>
          </div>
          <DateField label="De" name="inicio" value={periodo.inicioInput} />
          <DateField label="Até" name="fim" value={periodo.fimInput} />
          <button type="submit" className="rounded bg-[#3B82F6] px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-500">
            Atualizar relatório
          </button>
          <span className="pb-2 text-[10px] uppercase tracking-wider text-slate-500">
            {formatDate(periodo.inicio)} até {formatDate(periodo.fim)}
          </span>
        </form>
      </div>

      {!relatorio ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Selecione um soldador para visualizar o relatório.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-8">
            <Kpi label="Peças soldadas" value={numero(relatorio.totalSoldado)} destaque />
            <Kpi label="Peças recebidas" value={numero(relatorio.totalRecebido)} />
            <Kpi label="Dias trabalhados" value={String(relatorio.diasTrabalhados)} />
            <Kpi label="Média / dia" value={numero(relatorio.mediaDia, 1)} />
            <Kpi label="OPs atendidas" value={String(relatorio.opsAtendidas)} />
            <Kpi label="Melhor dia" value={relatorio.melhorDia ? `${relatorio.melhorDia.label} · ${relatorio.melhorDia.quantidade}` : "—"} texto />
            <Kpi label="Pior dia trabalhado" value={relatorio.piorDia ? `${relatorio.piorDia.label} · ${relatorio.piorDia.quantidade}` : "—"} texto />
            <Kpi label="Saldo recebido" value={numero(relatorio.saldoPeriodo)} alerta={relatorio.saldoPeriodo > 0} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Section title={`Produção soldada por dia · ${relatorio.soldador}`}>
              {relatorio.dias.length > 0 ? (
                <MiniBarChart data={relatorio.dias.map((item) => ({ label: item.label, value: item.quantidade }))} />
              ) : (
                <Empty text="Nenhuma peça soldada neste período." />
              )}
            </Section>
            <div className="rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-[#202A36] p-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Código mais soldado</span>
              {relatorio.codigoMaisSoldado ? (
                <>
                  <div className="mt-3 font-mono text-2xl font-bold text-white">{relatorio.codigoMaisSoldado.codigo}</div>
                  <div className="mt-1 text-xs text-slate-400">{relatorio.codigoMaisSoldado.nome ?? "Sem descrição"}</div>
                  <div className="mt-5 text-3xl font-light text-emerald-400">{numero(relatorio.codigoMaisSoldado.soldadas)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">peças soldadas</div>
                </>
              ) : <Empty text="Sem produção no período." />}
              <div className="mt-5 border-t border-white/5 pt-4 text-[10px] uppercase tracking-wider text-slate-500">
                Bancadas: <span className="text-slate-300">{relatorio.bancadas.join(", ") || "—"}</span>
              </div>
            </div>
          </div>

          <Section title={`Códigos soldados no período (${relatorio.codigos.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] text-slate-300">
                <thead><tr className="border-b border-white/5 bg-[#1A222C] text-slate-400">
                  <Th>Código</Th><Th>Descrição</Th><Th right>Soldadas</Th><Th right>Recebidas</Th><Th right>Saldo</Th><Th right>OPs</Th><Th right>Envios</Th><Th right>Conclusão</Th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {relatorio.codigos.map((item) => (
                    <tr key={item.codigo} className="hover:bg-[#2C3645]">
                      <Td mono>{item.codigo}</Td><Td muted>{item.nome ?? "—"}</Td>
                      <Td right green>{item.soldadas}</Td><Td right>{item.recebidas}</Td>
                      <Td right amber={item.saldo > 0}>{item.saldo}</Td><Td right>{item.ops}</Td><Td right>{item.envios}</Td>
                      <Td right><Progress value={item.percentual} /></Td>
                    </tr>
                  ))}
                  {relatorio.codigos.length === 0 && <tr><td colSpan={8}><Empty text="Nenhum código encontrado." /></td></tr>}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={`OPs atendidas (${relatorio.ops.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] text-slate-300">
                <thead><tr className="border-b border-white/5 bg-[#1A222C] text-slate-400">
                  <Th>OP</Th><Th>Código</Th><Th>Descrição</Th><Th right>Soldadas</Th><Th right>Dias</Th><Th>Primeiro apontamento</Th><Th>Último apontamento</Th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {relatorio.ops.map((item) => (
                    <tr key={item.opId} className="hover:bg-[#2C3645]">
                      <Td mono>{item.numero}</Td><Td mono>{item.codigo}</Td><Td muted>{item.nome ?? "—"}</Td>
                      <Td right green>{item.soldadas}</Td><Td right>{item.dias}</Td>
                      <Td>{formatDate(item.primeiro)}</Td><Td>{formatDate(item.ultimo)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function DateField({ label, name, value }: { label: string; name: string; value: string }) {
  return <div className="flex flex-col gap-1.5"><label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</label><input type="date" name={name} defaultValue={value} className={INPUT_CLS} /></div>;
}

function Kpi({ label, value, destaque = false, alerta = false, texto = false }: { label: string; value: string; destaque?: boolean; alerta?: boolean; texto?: boolean }) {
  return <div className="flex min-h-20 flex-col rounded-lg border border-white/5 bg-[#2C3645] px-4 py-3 shadow-lg"><span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</span><span className={`mt-1 ${texto ? "text-sm font-semibold" : "text-2xl font-light"} ${destaque ? "text-emerald-400" : alerta ? "text-amber-400" : "text-white"}`}>{value}</span></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-white/5 bg-[#202A36]"><div className="border-b border-white/5 bg-[#1A222C] px-5 py-3"><h2 className="text-sm font-semibold text-slate-100">{title}</h2></div>{children}</section>;
}

function Empty({ text }: { text: string }) { return <p className="px-5 py-10 text-center text-sm text-slate-500">{text}</p>; }
function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) { return <th className={`px-4 py-2.5 font-semibold ${right ? "text-right" : ""}`}>{children}</th>; }
function Td({ children, right = false, mono = false, muted = false, green = false, amber = false }: { children: React.ReactNode; right?: boolean; mono?: boolean; muted?: boolean; green?: boolean; amber?: boolean }) { return <td className={`px-4 py-2.5 ${right ? "text-right" : ""} ${mono ? "font-mono font-medium" : ""} ${muted ? "text-slate-400" : ""} ${green ? "font-bold text-emerald-400" : ""} ${amber ? "font-bold text-amber-400" : ""}`}>{children}</td>; }
function Progress({ value }: { value: number }) { return <span className={`inline-block rounded px-2 py-0.5 font-mono font-bold ${value >= 100 ? "bg-emerald-500/15 text-emerald-400" : value > 0 ? "bg-amber-500/15 text-amber-400" : "bg-slate-700/40 text-slate-500"}`}>{value}%</span>; }
function PdfIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5" strokeWidth={2}><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h4"/></svg>; }
