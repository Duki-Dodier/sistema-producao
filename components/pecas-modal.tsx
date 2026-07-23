"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { SetorProgresso } from "@/lib/pcp";
import { salvarRecebimentoAgrupamento } from "@/lib/actions/recebimentos-abastecimento";

type Recebimento = {
  id: number;
  opId: number;
  setorOrigemId: number;
  categoria: string;
  recebidoPor: string;
  localizacao: string;
  dataHora: Date | string;
};

type PecasModalProps = {
  isOpen: boolean;
  onClose: () => void;
  opId: number;
  opNum: number;
  modeloCodigo: string;
  imagemUrl: string | null;
  setor: SetorProgresso | null;
  categoria: string | null;
  recebimento: Recebimento | null;
};

function formatarDataHora(valor: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor));
}

export function PecasModal({
  isOpen,
  onClose,
  opId,
  opNum,
  modeloCodigo,
  imagemUrl,
  setor,
  categoria,
  recebimento,
}: PecasModalProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen || !setor || !categoria) return null;

  const temPecas = setor.pecas.length > 0;
  const temMaterial =
    setor.quantidadeBoa > 0 || setor.pecas.some((peca) => peca.produzida > 0);

  const handleSalvar = async (formData: FormData) => {
    setSalvando(true);
    setErro(null);
    try {
      await salvarRecebimentoAgrupamento(formData);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao confirmar o recebimento.");
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
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#242D3C] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 bg-[#1A222C] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded ${recebimento ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={2.2}>
                <path d="M20 7 10 17l-5-5" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-white">
                Recebimento de peças · <span className="uppercase text-amber-400">{setor.setorNome}</span>
              </h2>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                OP {opNum} <span className="mx-1 text-slate-600">|</span> SKU {modeloCodigo}
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

        <form action={handleSalvar} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="opId" value={opId} />
          <input type="hidden" name="setorOrigemId" value={setor.setorId} />
          <input type="hidden" name="categoria" value={categoria} />
          {setor.pecas.map((peca) => (
            <input key={peca.pecaId} type="hidden" name="pecaId" value={peca.pecaId} />
          ))}

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 md:flex-row">
            <div className="flex w-full shrink-0 flex-col gap-4 md:w-72">
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Referência visual
                </div>
                {setor.pecas[0]?.imagemUrl ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/5 bg-white/5">
                    <Image src={setor.pecas[0].imagemUrl} alt={`Peça ${setor.pecas[0].nome}`} fill sizes="288px" className="object-contain p-2" />
                  </div>
                ) : imagemUrl ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/5 bg-white/5">
                    <Image src={imagemUrl} alt={`Engate ${modeloCodigo}`} fill sizes="288px" className="object-contain p-2" />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/5 text-[11px] font-semibold text-slate-500">
                    Sem imagem cadastrada
                  </div>
                )}
              </div>

              {recebimento ? (
                <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-4">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Peças recebidas
                  </div>
                  <dl className="space-y-3 text-xs">
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Recebido por</dt>
                      <dd className="mt-0.5 font-semibold text-white">{recebimento.recebidoPor}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Localização</dt>
                      <dd className="mt-0.5 font-semibold text-emerald-300">{recebimento.localizacao}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Confirmado em</dt>
                      <dd className="mt-0.5 text-slate-300">{formatarDataHora(recebimento.dataHora)}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className={`rounded-lg border p-4 ${temMaterial ? "border-amber-400/50 bg-amber-500/10" : "border-slate-600 bg-slate-800/40"}`}>
                  <p className={`text-xs font-semibold ${temMaterial ? "text-amber-300" : "text-slate-400"}`}>
                    {temMaterial
                      ? "Aguardando o Abastecimento confirmar o recebimento."
                      : "Ainda não há peças produzidas para receber nesta célula."}
                  </p>
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div>
                <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Peças deste setor</span>
                  <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[9px] text-slate-300">
                    {temPecas ? `${setor.pecas.length} itens` : "Resumo do setor"}
                  </span>
                </div>

                {temPecas ? (
                  <div className="overflow-x-auto rounded-lg border border-white/5 bg-[#202A36]">
                    <table className="w-full border-collapse text-left text-[11px] text-slate-300">
                      <thead>
                        <tr className="border-b border-white/10 bg-[#1A222C] text-[9px] uppercase tracking-widest text-slate-400">
                          <th className="px-4 py-3 font-semibold">Peça</th>
                          <th className="px-3 py-3 text-center font-semibold">Nec.</th>
                          <th className="px-3 py-3 text-center font-semibold">Prod.</th>
                          <th className="px-3 py-3 text-center font-semibold">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {setor.pecas.map((peca) => (
                          <tr key={peca.pecaId} className="transition-colors hover:bg-[#2C3645]">
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs text-slate-200">{peca.nome}</div>
                              <div className="mt-0.5 text-[10px] font-medium text-slate-500">SKU: {peca.codigo}</div>
                            </td>
                            <td className="px-3 py-3 text-center font-bold">{peca.necessaria}</td>
                            <td className="px-3 py-3 text-center font-bold text-emerald-400">{peca.produzida}</td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-block rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${peca.completo ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400" : "border-amber-500/30 bg-amber-500/20 text-amber-400"}`}>
                                {peca.completo ? "Concluída" : `${peca.falta} faltando`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/5 bg-[#202A36] p-4">
                    <div className="rounded bg-[#1A222C] p-3 text-center">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Produzido</div>
                      <div className="mt-1 text-xl font-bold text-emerald-400">{setor.quantidadeBoa}</div>
                    </div>
                    <div className="rounded bg-[#1A222C] p-3 text-center">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Falta</div>
                      <div className="mt-1 text-xl font-bold text-amber-400">{setor.falta}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 rounded-lg border border-white/5 bg-[#202A36] p-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`recebido-${opId}-${setor.setorId}`} className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Quem recebeu as peças
                  </label>
                  <input
                    id={`recebido-${opId}-${setor.setorId}`}
                    name="recebidoPor"
                    required
                    maxLength={120}
                    defaultValue={recebimento?.recebidoPor ?? ""}
                    placeholder="Nome do operador"
                    className="w-full rounded border border-slate-700 bg-[#1A222C] px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 transition-colors focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`local-${opId}-${setor.setorId}`} className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Localização das peças
                  </label>
                  <input
                    id={`local-${opId}-${setor.setorId}`}
                    name="localizacao"
                    required
                    maxLength={160}
                    defaultValue={recebimento?.localizacao ?? ""}
                    placeholder="Ex.: Rack A · Prateleira 03"
                    className="w-full rounded border border-slate-700 bg-[#1A222C] px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 transition-colors focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 bg-[#1A222C] px-6 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Esta confirmação não altera os apontamentos de produção.
              </p>
              {erro && <p role="alert" className="mt-1 text-xs font-medium text-red-400">{erro}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded bg-slate-700 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-slate-600">
                Fechar
              </button>
              <button
                type="submit"
                disabled={salvando || !temMaterial}
                className="rounded bg-amber-500 px-6 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {salvando ? "Salvando..." : recebimento ? "Atualizar recebimento" : "Confirmar recebimento"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
