import { BotaoImprimir } from "@/components/botao-imprimir";
import type { PrioridadePrePronto } from "@/lib/prioridades-pre-pronto";

const CLASSIFICACAO = {
  FECHAR_PRE_PRONTO: {
    label: "Fechar pré-pronto",
    classe: "border-emerald-400/40 bg-emerald-400/15 text-emerald-300 print:border-emerald-700 print:bg-emerald-100 print:text-emerald-800",
  },
  QUASE_CONCLUIDA: {
    label: "Quase concluída",
    classe: "border-amber-400/40 bg-amber-400/15 text-amber-200 print:border-amber-700 print:bg-amber-100 print:text-amber-800",
  },
} as const;

export function PreProntoPriorityReport({
  itens,
  setorId,
  setores,
  busca,
}: {
  itens: PrioridadePrePronto[];
  setorId: number | null;
  setores: { id: number; nome: string }[];
  busca: string;
}) {
  const setor = setores.find((item) => item.id === setorId);
  const fechar = itens.filter((item) => item.classificacao === "FECHAR_PRE_PRONTO").length;
  const quase = itens.filter((item) => item.classificacao === "QUASE_CONCLUIDA").length;

  return (
    <section className="rounded-xl border border-emerald-400/25 bg-[#101b2b] shadow-[0_0_20px_rgba(16,185,129,.06)] print:border-slate-300 print:bg-white print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-4 print:border-slate-300 print:p-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-emerald-300 print:text-black">
              Prioridades para fechar pré-pronto
            </h2>
            <span className="rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300 print:border-slate-400 print:bg-white print:text-black">
              {setor?.nome ?? "Selecione um setor"}
            </span>
          </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-400 print:text-slate-700">
            Relatório para entregar ao líder: mostra somente a última peça pendente da OP ou peças com até 10% restante.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Buscar OP ou modelo</span>
              <input name="busca" defaultValue={busca} placeholder="Ex.: 6 ou AD1001" className="w-36 rounded border border-[#3d494c] bg-[#060e20] px-3 py-2 text-xs text-white placeholder:text-slate-600" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Setor do relatório</span>
              <select name="prioridadeSetor" defaultValue={setorId ? String(setorId) : ""} className="rounded border border-[#3d494c] bg-[#060e20] px-3 py-2 text-xs text-white">
                {setores.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.nome}</option>)}
              </select>
            </label>
            <button type="submit" className="rounded border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-400/20">
              Atualizar fila
            </button>
          </form>
          <BotaoImprimir />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 print:grid-cols-4 print:p-3">
        <Resumo label="Itens de atenção" valor={String(itens.length)} cor="text-white" />
        <Resumo label="Fecham pré-pronto" valor={String(fechar)} cor="text-emerald-300" />
        <Resumo label="Quase concluídas" valor={String(quase)} cor="text-amber-300" />
        <Resumo label="OPs na fila" valor={String(new Set(itens.map((item) => item.opId)).size)} cor="text-cyan-300" />
      </div>

      {itens.length === 0 ? (
        <p className="border-t border-white/10 px-4 py-10 text-center text-sm text-slate-500 print:border-slate-300 print:text-slate-700">
          Não há peças em atenção neste setor nas OPs abertas com o filtro atual.
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-white/10 print:border-slate-300">
          <table className="w-full min-w-[980px] border-collapse text-left print:min-w-0 print:text-[10px]">
            <thead className="bg-white/[.03] print:bg-slate-100">
              <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500 print:text-black">
                <th className="px-3 py-2">Fila</th>
                <th className="px-3 py-2">OP / modelo</th>
                <th className="px-3 py-2">Peça</th>
                <th className="px-3 py-2">Próximo processo</th>
                <th className="px-3 py-2 text-right">Necessário</th>
                <th className="px-3 py-2 text-right">Pronto</th>
                <th className="px-3 py-2 text-right">Falta</th>
                <th className="px-3 py-2">Pré-pronto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.07] print:divide-slate-300">
              {itens.map((item, indice) => {
                const classificacao = CLASSIFICACAO[item.classificacao];
                return (
                  <tr key={item.chave} className="align-top hover:bg-white/[.025] print:hover:bg-transparent">
                    <td className="px-3 py-3 print:py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/15 font-mono text-[11px] font-bold text-emerald-300 print:bg-emerald-100 print:text-emerald-800">{indice + 1}</span>
                        <span className={`rounded border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider ${classificacao.classe}`}>{classificacao.label}</span>
                      </div>
                      <p className="mt-1 max-w-44 text-[10px] text-slate-500 print:text-slate-700">{item.motivo}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 print:py-2">
                      <div className="font-mono text-xs font-bold text-cyan-300 print:text-black">OP {item.numeroSequencia}</div>
                      <div className="text-[11px] text-slate-300 print:text-slate-700">{item.modeloCodigo}{item.lote ? ` · lote ${item.lote}` : ""}</div>
                    </td>
                    <td className="px-3 py-3 print:py-2">
                      <div className="font-mono text-xs font-bold text-white print:text-black">{item.pecaCodigo}</div>
                      <div className="max-w-52 text-[11px] text-slate-400 print:text-slate-700">{item.pecaNome}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 print:py-2">
                      <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 font-mono text-[10px] font-bold uppercase text-cyan-200 print:border-cyan-700 print:bg-cyan-100 print:text-cyan-800">{item.processoLabel}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-slate-300 print:text-black">{item.necessaria.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-emerald-300 print:text-emerald-800">{item.produzida.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-bold text-amber-300 print:text-amber-800">{item.restante.toLocaleString("pt-BR")}</td>
                    <td className="min-w-36 px-3 py-3 print:py-2">
                      <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-slate-400 print:text-slate-700"><span>{item.pecasCompletas}/{item.pecasTotal} peças</span><span>{item.preProntoPercentual}%</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800 print:bg-slate-200"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${item.preProntoPercentual}%` }} /></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Resumo({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1324] px-3 py-2 print:border-slate-300 print:bg-white">
      <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 print:text-slate-700">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold ${cor} print:text-black`}>{valor}</div>
    </div>
  );
}
