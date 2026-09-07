"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { conferirOpPlasmaSeguro, type ResultadoConferenciaNest } from "@/lib/actions/nests";

export function PlasmaConferenciaOPForm({
  opId,
  pecaId,
  necessaria,
  totalLiberado,
}: {
  opId: number;
  pecaId: number;
  necessaria: number;
  totalLiberado: number;
}) {
  const router = useRouter();
  const [informandoFalta, setInformandoFalta] = useState(false);
  const [recebidas, setRecebidas] = useState(String(necessaria));
  const [erroLocal, setErroLocal] = useState("");
  const [resultado, acao, pendente] = useActionState<ResultadoConferenciaNest | null, FormData>(conferirOpPlasmaSeguro, null);
  const quantidade = Number(recebidas);

  useEffect(() => {
    if (resultado?.ok) router.replace("/plasma/conferencia?conferido=1");
  }, [resultado, router]);

  function validarFalta(event: React.FormEvent<HTMLFormElement>) {
    if (!informandoFalta) return;
    if (!Number.isInteger(quantidade) || quantidade < totalLiberado || quantidade >= necessaria) {
      event.preventDefault();
      setErroLocal(`Informe uma quantidade entre ${totalLiberado} e ${Math.max(totalLiberado, necessaria - 1)}.`);
      return;
    }
    setErroLocal("");
  }

  return (
    <form action={acao} onSubmit={validarFalta} className="space-y-3">
      <input type="hidden" name="opId" value={opId} />
      <input type="hidden" name="pecaId" value={pecaId} />
      {!informandoFalta && <input type="hidden" name="quantidadeRecebida" value={necessaria} />}

      {informandoFalta ? (
        <div className="rounded-2xl border border-rose-300/35 bg-rose-400/10 p-4">
          <p className="text-base font-black text-rose-100">Informar falta</p>
          <p className="mt-1 text-sm text-rose-100/75">Digite somente a quantidade realmente recebida. A diferença irá para Reposição e nada será liberado agora.</p>
          <label className="mt-4 block">
            <span className="text-sm font-bold text-rose-100">Quantidade recebida</span>
            <input
              name="quantidadeRecebida"
              type="number"
              min={totalLiberado}
              max={Math.max(totalLiberado, necessaria - 1)}
              step="1"
              inputMode="numeric"
              value={recebidas}
              onChange={(event) => setRecebidas(event.target.value)}
              required
              className="mt-2 min-h-14 w-full rounded-xl border border-rose-300/35 bg-slate-950/35 px-4 text-2xl font-black text-white outline-none focus:border-rose-200 focus:ring-1 focus:ring-rose-200/40"
            />
          </label>
          <p className="mt-2 text-sm font-bold text-rose-100">Falta calculada: {Math.max(0, necessaria - (Number.isFinite(quantidade) ? quantidade : 0))} peça(s)</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setInformandoFalta(false); setRecebidas(String(necessaria)); setErroLocal(""); }} disabled={pendente} className="min-h-12 rounded-xl border border-slate-500 px-3 py-2 text-sm font-bold text-slate-200 transition hover:border-slate-300">
              Voltar
            </button>
            <button type="submit" name="acaoConferencia" value="falta" disabled={pendente} className="min-h-12 rounded-xl bg-rose-300 px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-rose-200 disabled:cursor-wait disabled:opacity-60">
              {pendente ? "Salvando..." : "Enviar para reposição"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button type="submit" name="acaoConferencia" value="confirmar" disabled={pendente} className="min-h-14 w-full rounded-2xl bg-amber-300 px-4 py-3 text-base font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60">
            {pendente ? "Confirmando..." : `Confirmar ${necessaria} peças recebidas`}
          </button>
          <button type="button" onClick={() => setInformandoFalta(true)} disabled={pendente} className="min-h-12 w-full rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-wait disabled:opacity-60">
            Informar falta
          </button>
        </>
      )}

      {(erroLocal || (resultado && !resultado.ok)) && (
        <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm leading-relaxed text-rose-100">
          {erroLocal || (resultado && !resultado.ok ? resultado.mensagem : "")}
        </p>
      )}
    </form>
  );
}
