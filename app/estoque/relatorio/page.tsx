import Link from "next/link";
import { BotaoImprimir } from "@/components/botao-imprimir";
import {
  formatarDataHoraEstoque,
  montarRelatorioEstoque,
} from "@/lib/estoque-relatorio";

function dataFiltro(valor: string) {
  if (!valor) return "início do histórico";
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default async function RelatorioEstoquePage({
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
  const emitidoEm = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  const fimDoRelatorio = relatorio.filtros.fimInput
    ? dataFiltro(relatorio.filtros.fimInput)
    : new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());

  return (
    <div className="min-h-full bg-slate-200 p-4 text-slate-950 print:bg-white print:p-0">
      <style>{`@page { size: A4 landscape; margin: 9mm; } @media print { .quebra-pagina { break-before: page; } tr { break-inside: avoid; } }`}</style>
      <div className="mx-auto max-w-[1400px] rounded-lg bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div className="mb-5 flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">MES · Produto acabado</p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-tight">Relatório de Estoque</h1>
            <p className="mt-1 text-xs text-slate-600">Entradas provenientes da Montagem com rastreabilidade por código, lote e OP.</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Link href={`/estoque?${new URLSearchParams(Object.entries(sp).filter((item): item is [string, string] => Boolean(item[1]))).toString()}`} className="rounded border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">Voltar</Link>
            <BotaoImprimir />
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 rounded border border-slate-300 bg-slate-50 p-3 text-[10px] uppercase tracking-wide sm:grid-cols-5">
          <Info nome="Código" valor={relatorio.filtros.codigo || "Todos"} />
          <Info nome="Linha" valor={relatorio.filtros.linha || "Todas"} />
          <Info nome="Período" valor={`${dataFiltro(relatorio.filtros.inicioInput)} até ${fimDoRelatorio}`} />
          <Info nome="Emitido em" valor={emitidoEm} />
          <Info nome="Critério" valor="Entradas acumuladas" />
        </div>

        <div className="mb-5 grid grid-cols-5 gap-2">
          <Kpi nome="Acumulado" valor={relatorio.totalAcumulado} />
          <Kpi nome="No período" valor={relatorio.totalPeriodo} />
          <Kpi nome="Códigos" valor={relatorio.modelos} />
          <Kpi nome="OPs finalizadas" valor={relatorio.opsFinalizadas} />
          <Kpi nome="Lotes" valor={relatorio.lotes} />
        </div>

        <h2 className="mb-2 border-b border-slate-400 pb-1 text-xs font-black uppercase tracking-wide">Resumo acumulado por código</h2>
        <table className="w-full border-collapse text-[10px]">
          <thead><tr className="bg-slate-900 text-left uppercase tracking-wide text-white"><Th>Código</Th><Th>Descrição</Th><Th>Linha</Th><Th right>Quantidade</Th><Th right>OPs</Th><Th right>Lotes</Th><Th>Última entrada</Th></tr></thead>
          <tbody>{relatorio.resumo.map((item, indice) => <tr key={item.modeloId} className={indice % 2 ? "bg-slate-50" : "bg-white"}><Td mono>{item.codigo}</Td><Td>{item.nome ?? "—"}</Td><Td>{item.linhaProduto}</Td><Td right bold>{item.quantidade}</Td><Td right>{item.ops}</Td><Td right>{item.lotes}</Td><Td>{formatarDataHoraEstoque(item.ultimaEntrada)}</Td></tr>)}{relatorio.resumo.length === 0 && <tr><td colSpan={7} className="border border-slate-300 p-6 text-center text-slate-500">Nenhuma entrada encontrada.</td></tr>}</tbody>
        </table>

        <div className="quebra-pagina pt-5">
          <h2 className="mb-2 border-b border-slate-400 pb-1 text-xs font-black uppercase tracking-wide">Movimentações e lotes ({relatorio.movimentos.length})</h2>
          <table className="w-full border-collapse text-[9px]">
            <thead><tr className="bg-slate-900 text-left uppercase tracking-wide text-white"><Th>Data</Th><Th>Código</Th><Th>Lote</Th><Th>OP</Th><Th right>Entrada</Th><Th right>Recebido / OP</Th><Th right>Progresso</Th><Th>Situação</Th><Th>Responsável</Th></tr></thead>
            <tbody>{relatorio.movimentos.map((item, indice) => <tr key={item.id} className={indice % 2 ? "bg-slate-50" : "bg-white"}><Td>{formatarDataHoraEstoque(item.dataHora)}</Td><Td mono>{item.op.modelo.codigo}</Td><Td mono>{item.op.lote ?? "—"}</Td><Td mono>{item.op.numeroSequencia}</Td><Td right bold>+{item.quantidade}</Td><Td right>{item.totalRecebidoNaOp} / {item.op.quantidade}</Td><Td right>{item.percentualOp}%</Td><Td>{item.op.status === "CONCLUIDA" ? "FINALIZADA" : "PARCIAL"}</Td><Td>{item.usuario}</Td></tr>)}{relatorio.movimentos.length === 0 && <tr><td colSpan={9} className="border border-slate-300 p-6 text-center text-slate-500">Nenhuma movimentação encontrada.</td></tr>}</tbody>
          </table>
        </div>

        <div className="mt-4 border-t border-slate-300 pt-2 text-[9px] leading-4 text-slate-500">
          A quantidade apresentada corresponde às entradas acumuladas no Estoque. Este relatório ainda não desconta expedições ou faturamento. A OP é finalizada automaticamente quando o total recebido atinge a quantidade planejada.
        </div>
      </div>
    </div>
  );
}

function Info({ nome, valor }: { nome: string; valor: string }) { return <div><p className="font-bold text-slate-500">{nome}</p><p className="mt-0.5 font-semibold text-slate-900">{valor}</p></div>; }
function Kpi({ nome, valor }: { nome: string; valor: number }) { return <div className="rounded border border-slate-300 p-3 text-center"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{nome}</p><p className="mt-1 text-xl font-black">{valor}</p></div>; }
function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) { return <th className={`border border-slate-700 px-2 py-2 ${right ? "text-right" : ""}`}>{children}</th>; }
function Td({ children, right = false, mono = false, bold = false }: { children: React.ReactNode; right?: boolean; mono?: boolean; bold?: boolean }) { return <td className={`border border-slate-300 px-2 py-1.5 ${right ? "text-right" : ""} ${mono ? "font-mono" : ""} ${bold ? "font-black" : ""}`}>{children}</td>; }
