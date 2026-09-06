"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { registrarLancamentoNest } from "@/lib/actions/nests";

type ResultadoLancamento =
  | { ok: true }
  | { ok: false; mensagem: string };

const ESTADO_INICIAL: ResultadoLancamento | null = null;

export function PlasmaProductionForm({
  nestItemId,
  restante,
}: {
  nestItemId: number;
  restante: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [resultado, acao, pendente] = useActionState<ResultadoLancamento | null, FormData>(
    async (_anterior, formData) => {
      try {
        await registrarLancamentoNest(formData);
        return { ok: true };
      } catch (erro) {
        return { ok: false, mensagem: erro instanceof Error ? erro.message : "Não foi possível salvar a produção." };
      }
    },
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (!resultado?.ok) return;
    formRef.current?.reset();
    router.refresh();
  }, [resultado, router]);

  return (
    <form ref={formRef} action={acao} className="mt-3 space-y-2 border-t border-slate-700/70 pt-3">
      <input type="hidden" name="nestItemId" value={nestItemId} />
      <input type="hidden" name="tipo" value="PRODUCAO" />
      <div className="grid grid-cols-2 gap-2">
        <label className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-2.5">
          <span className="font-mono text-[10px] font-bold uppercase text-emerald-200">Boas</span>
          <input name="quantidadeBoa" type="number" min="0" max={restante} step="1" defaultValue="0" required className="mt-1 w-full bg-transparent text-xl font-black text-white outline-none" />
        </label>
        <label className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-2.5">
          <span className="font-mono text-[10px] font-bold uppercase text-rose-200">Perdas</span>
          <input name="quantidadeRefugo" type="number" min="0" max={restante} step="1" defaultValue="0" required className="mt-1 w-full bg-transparent text-xl font-black text-white outline-none" />
        </label>
      </div>
      <input name="motivoRefugo" placeholder="Motivo da perda, se houver" className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/30 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400" />
      <button type="submit" disabled={pendente} className="min-h-11 w-full rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60">
        {pendente ? "Salvando..." : "Salvar quantidades"}
      </button>
      {resultado && !resultado.ok && <p role="alert" className="rounded-lg border border-rose-300/25 bg-rose-400/10 p-2.5 text-xs leading-relaxed text-rose-100">{resultado.mensagem}</p>}
      {resultado?.ok && <p role="status" className="text-xs font-semibold text-emerald-200">Quantidades salvas.</p>}
    </form>
  );
}
