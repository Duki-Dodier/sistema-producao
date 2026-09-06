"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarLancamentoNestSeguro, type ResultadoLancamentoNest } from "@/lib/actions/nests";

const ESTADO_INICIAL: ResultadoLancamentoNest | null = null;

export function PlasmaProductionForm({
  nestItemId,
  restante,
}: {
  nestItemId: number;
  restante: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [erroLocal, setErroLocal] = useState("");
  const [resultado, acao, pendente] = useActionState(registrarLancamentoNestSeguro, ESTADO_INICIAL);

  useEffect(() => {
    if (!resultado?.ok) return;
    formRef.current?.reset();
    router.refresh();
  }, [resultado, router]);

  return (
    <form ref={formRef} action={acao} className="mt-3 space-y-2 border-t border-slate-700/70 pt-3" onSubmit={(event) => {
      const dados = new FormData(event.currentTarget);
      const boas = Number(dados.get("quantidadeBoa") ?? 0);
      const perdas = Number(dados.get("quantidadeRefugo") ?? 0);
      if (!boas && !perdas) {
        event.preventDefault();
        setErroLocal("Informe ao menos uma peça boa ou uma perda.");
      } else {
        setErroLocal("");
      }
    }}>
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
      {(erroLocal || (resultado && !resultado.ok)) && <p role="alert" className="rounded-lg border border-rose-300/25 bg-rose-400/10 p-2.5 text-xs leading-relaxed text-rose-100">{erroLocal || (resultado && !resultado.ok ? resultado.mensagem : "")}</p>}
      {resultado?.ok && <p role="status" className="text-xs font-semibold text-emerald-200">Quantidades salvas.</p>}
    </form>
  );
}
