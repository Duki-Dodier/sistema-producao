"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { createApontamentoSolda } from "@/lib/actions/solda";

type Sugestoes = {
  soldadores: string[];
  bancadas: string[];
  abastecedores: string[];
};

type EnvioSoldaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  opId: number;
  opNum: number;
  modeloCodigo: string;
  quantidadeOP: number;
  saldo: number; // quanto ainda falta enviar
  sugestoes: Sugestoes;
};

const INPUT_CLS =
  "w-full rounded bg-[#1A222C] border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-[#3B82F6] focus:outline-none transition-colors";

export function EnvioSoldaModal({
  isOpen,
  onClose,
  opId,
  opNum,
  modeloCodigo,
  quantidadeOP,
  saldo,
  sugestoes,
}: EnvioSoldaModalProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [enviando, setEnviando] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const handleSubmit = async (formData: FormData) => {
    setEnviando(true);
    try {
      await createApontamentoSolda(formData);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar para a Solda.");
    } finally {
      setEnviando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/10 bg-[#242D3C] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/5 bg-[#1A222C] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-emerald-500/20 text-emerald-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth={2.5}>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-white">
                Enviar para <span className="text-emerald-400">Solda</span>
              </h2>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                OP {opNum} <span className="mx-1 text-slate-600">|</span> SKU{" "}
                {modeloCodigo}
                <span className="mx-1 text-slate-600">|</span> saldo {saldo} de{" "}
                {quantidadeOP} pçs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded bg-white/5 p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* FORM */}
        <form action={handleSubmit} className="flex flex-col gap-4 p-6">
          <input type="hidden" name="opId" value={opId} />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Bancada
              </label>
              <input
                name="bancada"
                required
                list="envio-bancadas"
                placeholder="Ex.: BOX 22"
                className={INPUT_CLS}
              />
              <datalist id="envio-bancadas">
                {sugestoes.bancadas.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Soldador
              </label>
              <select
                name="soldador"
                required
                defaultValue=""
                className={INPUT_CLS}
              >
                <option value="" disabled>
                  Selecione o soldador
                </option>
                {sugestoes.soldadores.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {sugestoes.soldadores.length === 0 && (
                <span className="text-[10px] text-amber-400">
                  Nenhum funcionário ativo cadastrado no setor Solda.
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Quem abastece
              </label>
              <input
                name="abastecedor"
                list="envio-abastecedores"
                placeholder="Nome"
                className={INPUT_CLS}
              />
              <datalist id="envio-abastecedores">
                {sugestoes.abastecedores.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Data
              </label>
              <input name="data" type="date" defaultValue={hoje} className={INPUT_CLS} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Quantidade{" "}
                <span className="normal-case text-slate-500">
                  (divida a OP enviando parcial p/ outro soldador depois)
                </span>
              </label>
              <input
                name="quantidadeBoa"
                type="number"
                min={1}
                max={saldo}
                required
                defaultValue={saldo}
                className={INPUT_CLS}
              />
            </div>
          </div>

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
              disabled={enviando}
              className={`rounded bg-emerald-600 px-6 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-500 ${
                enviando ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              {enviando ? "Enviando..." : "Enviar p/ Solda"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
