"use client";

import { useMemo, useState } from "react";
import { AjustarApontamentoBotao } from "@/components/ajustar-apontamento-botao";
import { formatDateTime } from "@/lib/format";
import { PROCESSOS, PROCESSO_LABEL } from "@/lib/processos";
import type { Autorizador } from "@/components/ajuste-apontamento-modal";

type HistoricoItem = {
  id: number;
  dataHora: string;
  opNumero: number;
  modeloCodigo: string;
  pecaCodigo: string | null;
  pecaNome: string | null;
  processo: string | null;
  processoLabel: string;
  usuario: string;
  quantidadeBoa: number;
  setorId: number;
  setorNome: string;
  ultimoAjuste: {
    valorAnterior: number;
    valorNovo: number;
    autorizadoPor: string;
    motivo: string;
  } | null;
};

export function HistoricoApontamentos({
  setorNome,
  apontamentos,
  autorizadores,
}: {
  setorNome: string;
  apontamentos: HistoricoItem[];
  autorizadores: Autorizador[];
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [operador, setOperador] = useState("");
  const [processo, setProcesso] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  const operadores = useMemo(
    () => [...new Set(apontamentos.map((item) => item.usuario))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [apontamentos],
  );
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return apontamentos.filter((item) => {
      const texto = [item.opNumero, item.modeloCodigo, item.pecaCodigo, item.pecaNome, item.usuario]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      const data = item.dataHora.slice(0, 10);
      return (
        (!termo || texto.includes(termo)) &&
        (!operador || item.usuario === operador) &&
        (!processo || item.processo === processo) &&
        (!dataDe || data >= dataDe) &&
        (!dataAte || data <= dataAte)
      );
    });
  }, [apontamentos, busca, operador, processo, dataDe, dataAte]);

  const limparFiltros = () => {
    setBusca("");
    setOperador("");
    setProcesso("");
    setDataDe("");
    setDataAte("");
  };

  return (
    <section className="rounded-lg border border-white/5 bg-[#202A36] shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-white/5 bg-[#1A222C] px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Histórico de apontamentos · {setorNome}</h2>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">Últimos {apontamentos.length} registros carregados</p>
        </div>
        <button
          type="button"
          aria-expanded={aberto}
          onClick={() => setAberto((valor) => !valor)}
          className="rounded-lg border border-[#4cd7f6]/40 bg-[#4cd7f6]/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#4cd7f6] transition hover:bg-[#4cd7f6]/20"
        >
          {aberto ? "Fechar histórico" : "Abrir histórico"}
        </button>
      </div>

      {aberto && (
        <div className="p-4">
          <div className="grid gap-3 rounded-lg border border-[#2d3449] bg-[#131b2e] p-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar OP, peça ou operador"
              className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#4cd7f6] xl:col-span-2"
            />
            <select
              value={operador}
              onChange={(event) => setOperador(event.target.value)}
              className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6]"
            >
              <option value="">Todos os operadores</option>
              {operadores.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
            </select>
            <select
              value={processo}
              onChange={(event) => setProcesso(event.target.value)}
              className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6]"
            >
              <option value="">Todos os processos</option>
              {PROCESSOS.map((codigo) => (
                <option key={codigo} value={codigo}>{PROCESSO_LABEL[codigo]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={limparFiltros}
              className="rounded-lg border border-slate-600 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-slate-400 hover:text-white"
            >
              Limpar filtros
            </button>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              De
              <input type="date" value={dataDe} onChange={(event) => setDataDe(event.target.value)} className="mt-1 block w-full rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-[#4cd7f6]" />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Até
              <input type="date" value={dataAte} onChange={(event) => setDataAte(event.target.value)} className="mt-1 block w-full rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-[#4cd7f6]" />
            </label>
            <div className="flex items-end pb-2 font-mono text-[11px] text-slate-400 md:col-span-2 xl:col-span-3">
              {filtrados.length} registro(s) encontrado(s)
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Data/hora</th>
                  <th className="px-4 py-3">OP</th>
                  <th className="px-4 py-3">Peça</th>
                  <th className="px-4 py-3">Processo</th>
                  <th className="px-4 py-3">Operador</th>
                  <th className="px-4 py-3 text-right">Quantidade</th>
                  <th className="px-4 py-3 text-right">Correção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtrados.map((item) => (
                  <tr key={item.id} className="hover:bg-[#2C3645]">
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(item.dataHora)}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">OP {item.opNumero} · {item.modeloCodigo}</td>
                    <td className="px-4 py-3 text-slate-300">{item.pecaCodigo ? `${item.pecaCodigo} · ${item.pecaNome}` : "Produção do setor"}</td>
                    <td className="px-4 py-3 text-slate-400">{item.processoLabel}</td>
                    <td className="px-4 py-3 text-slate-400">{item.usuario}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      {item.quantidadeBoa}
                      {item.ultimoAjuste && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400" title={`Ajustado de ${item.ultimoAjuste.valorAnterior} para ${item.ultimoAjuste.valorNovo} por ${item.ultimoAjuste.autorizadoPor} — ${item.ultimoAjuste.motivo}`}>ajustado</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AjustarApontamentoBotao
                        apontamento={{
                          id: item.id,
                          descricao: `OP ${item.opNumero} · ${item.modeloCodigo} · ${item.pecaCodigo ?? "Produção"} · ${item.processoLabel}`,
                          setorId: item.setorId,
                          setorNome: item.setorNome,
                          quantidadeAtual: item.quantidadeBoa,
                          usuario: item.usuario,
                        }}
                        autorizadores={autorizadores}
                      />
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Nenhum registro encontrado com esses filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
