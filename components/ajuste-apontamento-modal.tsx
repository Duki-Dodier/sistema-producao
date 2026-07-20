"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ajustarApontamento } from "@/lib/actions/ajustes";

export type Autorizador = {
  id: number;
  nome: string;
  papel: string; // LIDER | PCP
  setorId: number;
  setorNome: string;
  temPin: boolean;
};

export type ApontamentoParaAjuste = {
  id: number;
  descricao: string; // "OP 12 · TO1007 · Tubo 1000x50x3mm · Corte"
  setorId: number;
  setorNome: string;
  quantidadeAtual: number;
  usuario: string;
};

const INPUT_CLS =
  "w-full rounded border border-slate-700 bg-[#1A222C] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-[#3B82F6] focus:outline-none transition-colors";

export function AjusteApontamentoModal({
  apontamento,
  autorizadores,
  onClose,
}: {
  apontamento: ApontamentoParaAjuste;
  autorizadores: Autorizador[];
  onClose: () => void;
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [autorizadorId, setAutorizadorId] = useState("");

  if (!mounted) return null;

  // Líder só autoriza o próprio setor; PCP autoriza qualquer um.
  const elegiveis = autorizadores.filter(
    (a) => a.papel === "PCP" || a.setorId === apontamento.setorId,
  );
  const autorizador = elegiveis.find((a) => String(a.id) === autorizadorId) ?? null;

  const handleSalvar = async (formData: FormData) => {
    setSalvando(true);
    setErro(null);
    try {
      await ajustarApontamento(formData);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar o ajuste.");
    } finally {
      setSalvando(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/10 bg-[#242D3C] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 bg-[#1A222C] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded bg-amber-500/20 text-amber-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-white">
                Ajustar apontamento
              </h2>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {apontamento.descricao}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded bg-white/5 p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form action={handleSalvar} className="flex flex-col gap-4 p-6">
          <input type="hidden" name="apontamentoId" value={apontamento.id} />

          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#1A222C] px-4 py-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Lançado por
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-200">
                {apontamento.usuario} · {apontamento.setorNome}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Quantidade atual
              </div>
              <div className="mt-0.5 font-mono text-2xl font-bold text-white">
                {apontamento.quantidadeAtual}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Quantidade correta
              </label>
              <input
                name="quantidadeCorreta"
                type="number"
                min={0}
                required
                autoFocus
                className={`text-center font-mono text-lg font-bold ${INPUT_CLS}`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Autorizado por
              </label>
              <select
                name="autorizadorId"
                required
                value={autorizadorId}
                onChange={(event) => setAutorizadorId(event.target.value)}
                className={INPUT_CLS}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {elegiveis.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} · {a.papel === "PCP" ? "PCP" : `Líder ${a.setorNome}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Motivo do ajuste
            </label>
            <input
              name="motivo"
              required
              maxLength={200}
              placeholder="Ex.: digitado 479 em vez de 47"
              className={INPUT_CLS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              PIN do autorizador
            </label>
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              required
              maxLength={4}
              pattern="\d{4}"
              placeholder="••••"
              className={`w-32 text-center font-mono tracking-[0.4em] ${INPUT_CLS}`}
            />
            {autorizador && !autorizador.temPin && (
              <p className="text-[11px] font-semibold text-amber-400">
                {autorizador.nome} ainda não tem PIN — cadastre em Configurações.
              </p>
            )}
          </div>

          {erro && (
            <p role="alert" className="rounded bg-red-500/10 p-3 text-sm text-red-300">
              {erro}
            </p>
          )}

          {elegiveis.length === 0 && (
            <p className="rounded bg-amber-500/10 p-3 text-sm text-amber-300">
              Nenhum Líder deste setor nem PCP cadastrado — defina os papéis em
              Configurações.
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || elegiveis.length === 0}
              className={`rounded bg-amber-600 px-6 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-500 ${
                salvando ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              {salvando ? "Salvando..." : "Confirmar ajuste"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
