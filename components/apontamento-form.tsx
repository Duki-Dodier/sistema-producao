"use client";

import { useMemo, useState, useRef } from "react";
import { createApontamento } from "@/lib/actions/apontamentos";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

type PecaOption = {
  pecaId: number;
  codigo: string;
  nome: string;
  medida: string | null;
  necessaria: number;
  produzida: number;
};

type SetorOption = {
  setorId: number;
  setorNome: string;
  ordem: number;
  produzido: number;
  pecas: PecaOption[];
};

type OPOption = {
  id: number;
  numeroSequencia: number;
  modeloCodigo: string;
  quantidade: number;
  roteiro: SetorOption[];
};

export function ApontamentoForm({ ops }: { ops: OPOption[] }) {
  const [opId, setOpId] = useState<string>("");
  const [setorId, setSetorId] = useState<string>("");
  const [pecaId, setPecaId] = useState<string>("");
  const [operador, setOperador] = useState<string>("");
  const [qtd, setQtd] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const op = useMemo(() => ops.find((o) => String(o.id) === opId), [ops, opId]);
  const setoresDisponiveis = op?.roteiro ?? [];
  const setorSelecionado = setoresDisponiveis.find(
    (s) => String(s.setorId) === setorId,
  );
  const usaPecas = (setorSelecionado?.pecas.length ?? 0) > 0;
  const pecaSelecionada = setorSelecionado?.pecas.find(
    (p) => String(p.pecaId) === pecaId,
  );

  const comparativo = pecaSelecionada
    ? {
        rotulo: `${pecaSelecionada.codigo} · ${pecaSelecionada.nome}`,
        produzido: pecaSelecionada.produzida,
        necessario: pecaSelecionada.necessaria,
      }
    : setorSelecionado && !usaPecas
      ? {
          rotulo: setorSelecionado.setorNome,
          produzido: setorSelecionado.produzido,
          necessario: op?.quantidade ?? 0,
        }
      : null;

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setLoading(true);
    
    try {
      const formData = new FormData(ev.currentTarget);
      await createApontamento(formData);
      // Apaga só a quantidade para permitir digitação rápida do próximo
      setQtd(""); 
      // Focar de volta no input de quantidade se possível (mantém o fluxo rápido)
      const inputQtd = formRef.current?.elements.namedItem("quantidadeBoa");
      if (inputQtd instanceof HTMLInputElement) inputQtd.focus();
    } catch (err: unknown) {
      alert("Erro ao lançar apontamento: " + errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 px-5 py-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">OP (Ordem de Produção)</label>
          <select
            name="opId"
            required
            value={opId}
            onChange={(e) => {
              setOpId(e.target.value);
              setSetorId("");
              setPecaId("");
            }}
            className="rounded bg-[#1A222C] border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-[#3B82F6] focus:outline-none transition-colors"
          >
            <option value="" disabled>
              Selecione a OP...
            </option>
            {ops.map((o) => (
              <option key={o.id} value={o.id}>
                OP {o.numeroSequencia} · {o.modeloCodigo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Setor</label>
          <select
            name="setorId"
            required
            disabled={!opId}
            value={setorId}
            onChange={(e) => {
              setSetorId(e.target.value);
              setPecaId("");
            }}
            className="rounded bg-[#1A222C] border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-[#3B82F6] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="" disabled>
              {opId ? "Selecione o setor..." : "Escolha a OP primeiro"}
            </option>
            {setoresDisponiveis.map((s) => (
              <option key={s.setorId} value={s.setorId}>
                {s.ordem}. {s.setorNome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {usaPecas && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Peça</label>
          <select
            name="pecaId"
            required
            value={pecaId}
            onChange={(e) => setPecaId(e.target.value)}
            className="rounded bg-[#1A222C] border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-[#3B82F6] focus:outline-none transition-colors"
          >
            <option value="" disabled>
              Selecione a peça...
            </option>
            {setorSelecionado!.pecas.map((p) => (
              <option key={p.pecaId} value={p.pecaId}>
                {p.codigo} · {p.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {comparativo && (
        <div className="flex items-center justify-between rounded bg-[#202A36] border border-white/5 px-4 py-3 text-xs shadow-inner">
          <span className="text-slate-400">
            Já produzido em <strong className="text-slate-200 font-mono">{comparativo.rotulo}</strong>:{" "}
            <span className="text-white font-bold">{comparativo.produzido}</span> de {comparativo.necessario}
          </span>
          <span
            className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
              comparativo.necessario - comparativo.produzido <= 0
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            }`}
          >
            {comparativo.necessario - comparativo.produzido <= 0
              ? "CONCLUÍDO"
              : `FALTA ${comparativo.necessario - comparativo.produzido}`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Operador
          </label>
          <input
            name="usuario"
            required
            value={operador}
            onChange={e => setOperador(e.target.value)}
            placeholder="Nome do operador"
            className="rounded bg-[#1A222C] border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-[#3B82F6] focus:outline-none transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Qtd. produzida
          </label>
          <input
            name="quantidadeBoa"
            type="number"
            min={1}
            required
            value={qtd}
            onChange={e => setQtd(e.target.value)}
            placeholder="Ex: 10"
            className="rounded bg-[#1A222C] border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-[#3B82F6] focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
         <button type="submit" disabled={loading} className={`rounded bg-[#3B82F6] px-6 py-2.5 text-sm font-bold tracking-wider text-white uppercase shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
           {loading ? 'Lançando...' : 'Lançar Apontamento'}
         </button>
      </div>
    </form>
  );
}
