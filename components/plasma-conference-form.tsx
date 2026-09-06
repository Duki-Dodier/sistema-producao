"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { conferirLancamentoNestSeguro, type ResultadoConferenciaNest } from "@/lib/actions/nests";

const ESTADO_INICIAL: ResultadoConferenciaNest | null = null;

export function PlasmaConferenceForm({
  lancamentoId,
  quantidadeBoa,
  quantidadeRefugo,
}: {
  lancamentoId: number;
  quantidadeBoa: number;
  quantidadeRefugo: number;
}) {
  const router = useRouter();
  const [erroLocal, setErroLocal] = useState("");
  const [resultado, acao, pendente] = useActionState(conferirLancamentoNestSeguro, ESTADO_INICIAL);
  const totalDeclarado = quantidadeBoa + quantidadeRefugo;

  useEffect(() => {
    if (resultado?.ok) router.refresh();
  }, [resultado, router]);

  return (
    <form action={acao} className="mt-4 space-y-3 border-t border-amber-400/15 pt-4" onSubmit={(event) => {
      const dados = new FormData(event.currentTarget);
      const boas = Number(dados.get("quantidadeConferidaBoa") ?? 0);
      const motivo = String(dados.get("motivoConferencia") ?? "").trim();
      if (!Number.isInteger(boas) || boas < 0 || boas > totalDeclarado) {
        event.preventDefault();
        setErroLocal(`Informe um total de boas entre 0 e ${totalDeclarado}.`);
      } else if (boas !== quantidadeBoa && !motivo) {
        event.preventDefault();
        setErroLocal("Informe o motivo da divergência.");
      } else {
        setErroLocal("");
      }
    }}>
      <input type="hidden" name="lancamentoId" value={lancamentoId} />
      <label className="block">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-200">Boas confirmadas</span>
        <input name="quantidadeConferidaBoa" type="number" min="0" max={totalDeclarado} step="1" defaultValue={quantidadeBoa} required className="mt-1 min-h-12 w-full rounded-xl border border-amber-400/30 bg-slate-950/35 px-3 text-lg font-bold text-white outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300/30" />
      </label>
      <p className="text-xs text-slate-500">O restante será registrado como perda. Total declarado: {totalDeclarado}.</p>
      <input name="motivoConferencia" placeholder="Motivo se houver divergência" className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/30 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-300" />
      <button type="submit" disabled={pendente} className="min-h-12 w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60">
        {pendente ? "Confirmando..." : "Conferir e liberar"}
      </button>
      {(erroLocal || (resultado && !resultado.ok)) && <p role="alert" className="rounded-lg border border-rose-300/25 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">{erroLocal || (resultado && !resultado.ok ? resultado.mensagem : "")}</p>}
    </form>
  );
}
