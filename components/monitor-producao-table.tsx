"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";

export type MonitorRegistro = {
  id: number;
  dataHora: string;
  opNumero: number;
  lote: string | null;
  modeloCodigo: string;
  pecaCodigo: string | null;
  pecaNome: string | null;
  processo: string | null;
  usuario: string;
  maquinaCodigo: string | null;
  quantidadeBoa: number;
  tempoSegundos: number | null;
};

export function MonitorProducaoTable({ registros }: { registros: MonitorRegistro[] }) {
  const [busca, setBusca] = useState("");
  const [operador, setOperador] = useState("");
  const [maquina, setMaquina] = useState("");

  const operadores = useMemo(
    () => [...new Set(registros.map((registro) => registro.usuario))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [registros],
  );
  const maquinas = useMemo(
    () => [...new Set(registros.map((registro) => registro.maquinaCodigo).filter(Boolean) as string[])].sort(),
    [registros],
  );
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return registros.filter((registro) => {
      const texto = [registro.opNumero, registro.lote, registro.modeloCodigo, registro.pecaCodigo, registro.pecaNome, registro.usuario, registro.maquinaCodigo]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return (
        (!termo || texto.includes(termo)) &&
        (!operador || registro.usuario === operador) &&
        (!maquina || registro.maquinaCodigo === maquina)
      );
    });
  }, [busca, maquina, operador, registros]);

  const totalPecas = filtrados.reduce((total, registro) => total + registro.quantidadeBoa, 0);
  const tempoTotal = filtrados.reduce((total, registro) => total + (registro.tempoSegundos ?? 0), 0);

  return (
    <section className="overflow-hidden rounded-lg border" style={{ background: "#131b2e", borderColor: "#2d3449" }}>
      <div className="border-b px-5 py-3" style={{ borderColor: "#2d3449", background: "#171f33" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#dae2fd]">Registro por operador e máquina</h2>
            <p className="mt-1 text-[11px] text-slate-500">Cada peça, responsável, posto utilizado e tempo informado no apontamento.</p>
          </div>
          <div className="flex gap-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            <span>{filtrados.length} lançamentos</span>
            <span className="text-cyan-300">{totalPecas} peças</span>
            <span className="text-amber-300">{formatDuracao(tempoTotal)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b border-white/5 p-4 md:grid-cols-[minmax(220px,1fr)_200px_200px_auto]">
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar OP, peça, operador..."
          className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#4cd7f6]"
        />
        <select value={operador} onChange={(event) => setOperador(event.target.value)} className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6]">
          <option value="">Todos os operadores</option>
          {operadores.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
        </select>
        <select value={maquina} onChange={(event) => setMaquina(event.target.value)} className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2 text-sm text-white outline-none focus:border-[#4cd7f6]">
          <option value="">Todas as máquinas</option>
          {maquinas.map((codigo) => <option key={codigo} value={codigo}>{codigo}</option>)}
        </select>
        <button type="button" onClick={() => { setBusca(""); setOperador(""); setMaquina(""); }} className="rounded-lg border border-slate-600 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-slate-400 hover:text-white">
          Limpar
        </button>
      </div>

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="sticky top-0 z-10 bg-[#171f33]">
            <tr className="border-b border-white/5 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Data/hora</th>
              <th className="px-4 py-3">OP / peça</th>
              <th className="px-4 py-3">Processo</th>
              <th className="px-4 py-3">Operador</th>
              <th className="px-4 py-3">Máquina</th>
              <th className="px-4 py-3">Tempo</th>
              <th className="px-4 py-3 text-right">Peças</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtrados.map((registro) => (
              <tr key={registro.id} className="hover:bg-white/[0.03]">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(registro.dataHora)}</td>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs font-bold text-cyan-300">OP {registro.opNumero} · {registro.modeloCodigo}</div>
                  <div className="mt-1 text-xs text-slate-300">{registro.pecaCodigo ? `${registro.pecaCodigo} · ${registro.pecaNome}` : "Produção do setor"}</div>
                  {registro.lote && <div className="mt-1 font-mono text-[10px] text-slate-600">{registro.lote}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{registro.processo ?? "Produção geral"}</td>
                <td className="px-4 py-3 font-semibold text-slate-200">{registro.usuario}</td>
                <td className="px-4 py-3 font-mono text-xs text-cyan-200">{registro.maquinaCodigo ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-amber-200">{registro.tempoSegundos ? formatDuracao(registro.tempoSegundos) : "—"}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-300">{registro.quantidadeBoa}</td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">Nenhum registro encontrado para este período.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDuracao(segundos: number) {
  if (segundos <= 0) return "0min";
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return horas > 0 ? `${horas}h ${String(minutos).padStart(2, "0")}min` : `${minutos}min`;
}
