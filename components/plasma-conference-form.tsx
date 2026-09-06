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
  const [recebidas, setRecebidas] = useState(String(quantidadeBoa));
  const [resultado, acao, pendente] = useActionState(conferirLancamentoNestSeguro, ESTADO_INICIAL);
  const totalDeclarado = quantidadeBoa + quantidadeRefugo;
  const faltaConferente = Math.max(0, quantidadeBoa - (Number(recebidas) || 0));
  const faltaJaInformadaOperador = quantidadeRefugo > 0;

  useEffect(() => {
    if (resultado?.ok) router.refresh();
  }, [resultado, router]);

  return (
    <form action={acao} className="mt-4 space-y-3 border-t border-amber-400/15 pt-4" onSubmit={(event) => {
      const dados = new FormData(event.currentTarget);
      const totalRecebido = Number(dados.get("quantidadeRecebida") ?? 0);
      if (!Number.isInteger(totalRecebido) || totalRecebido < 0 || totalRecebido > totalDeclarado) {
        event.preventDefault();
        setErroLocal(`Informe um total recebido entre 0 e ${totalDeclarado}.`);
      } else {
        setErroLocal("");
      }
      }}>
      <input type="hidden" name="lancamentoId" value={lancamentoId} />
      <label className="block">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-200">Total recebido</span>
        <input name="quantidadeRecebida" type="number" min="0" max={totalDeclarado} step="1" value={recebidas} onChange={(event) => setRecebidas(event.target.value)} required className="mt-1 min-h-12 w-full rounded-xl border border-amber-400/30 bg-slate-950/35 px-3 text-lg font-bold text-white outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300/30" />
      </label>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <p className="rounded-lg border border-slate-700 bg-slate-950/25 px-3 py-2 text-slate-500">Declarado pelo operador<strong className="mt-1 block text-slate-200">{quantidadeBoa} boas · {quantidadeRefugo} perdas</strong></p>
        <p className="rounded-lg border border-rose-400/25 bg-rose-400/5 px-3 py-2 text-slate-500">Falta adicional do conferente<strong className="mt-1 block text-rose-200">{faltaConferente} peça(s)</strong></p>
      </div>
      <p className="text-xs text-slate-500">O total recebido será liberado; a diferença será registrada como perda. A perda já apontada pelo operador não será duplicada.</p>
      <input name="motivoConferencia" placeholder="Motivo se houver divergência" className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/30 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-300" />
      <button type="submit" name="acaoConferencia" value="confirmar" disabled={pendente} className="min-h-12 w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60">
        {pendente ? "Confirmando..." : "Confirmar total recebido"}
      </button>
      {(faltaConferente > 0 || faltaJaInformadaOperador) && <button type="submit" name="acaoConferencia" value="falta" disabled={pendente} className="min-h-11 w-full rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-2.5 text-sm font-bold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-wait disabled:opacity-60">{faltaConferente > 0 ? `Confirmar e enviar ${faltaConferente} para reposição` : "Registrar que a falta já foi informada"}</button>}
      {(erroLocal || (resultado && !resultado.ok)) && <p role="alert" className="rounded-lg border border-rose-300/25 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">{erroLocal || (resultado && !resultado.ok ? resultado.mensagem : "")}</p>}
    </form>
  );
}
