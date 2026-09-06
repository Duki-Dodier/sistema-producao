"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { conferirOpPlasmaSeguro, type ResultadoConferenciaNest } from "@/lib/actions/nests";

export function PlasmaConferenciaOPForm({
  opId,
  pecaId,
  necessaria,
  totalLiberado,
  totalDeclarado,
  totalPerdasDeclaradas,
}: {
  opId: number;
  pecaId: number;
  necessaria: number;
  totalLiberado: number;
  totalDeclarado: number;
  totalPerdasDeclaradas: number;
}) {
  const router = useRouter();
  const [recebidas, setRecebidas] = useState(String(necessaria));
  const [motivo, setMotivo] = useState("");
  const [erroLocal, setErroLocal] = useState("");
  const [resultado, acao, pendente] = useActionState<ResultadoConferenciaNest | null, FormData>(conferirOpPlasmaSeguro, null);
  const quantidade = Number(recebidas);
  const quantidadeValida = Number.isInteger(quantidade) && quantidade >= 0 ? quantidade : 0;
  const falta = Math.max(0, necessaria - quantidadeValida);
  const acaoConferencia = falta > 0 ? "falta" : "confirmar";

  useEffect(() => {
    if (resultado?.ok) router.refresh();
  }, [resultado, router]);

  return (
    <form action={acao} className="space-y-4" onSubmit={(event) => {
      const valor = Number(recebidas);
      if (!Number.isInteger(valor) || valor < 0 || valor > necessaria) {
        event.preventDefault();
        setErroLocal(`Informe um total recebido entre 0 e ${necessaria}.`);
      } else if (valor < totalLiberado) {
        event.preventDefault();
        setErroLocal(`O total não pode ser menor que o já liberado (${totalLiberado}).`);
      } else {
        setErroLocal("");
      }
    }}>
      <input type="hidden" name="opId" value={opId} />
      <input type="hidden" name="pecaId" value={pecaId} />
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">Conferência final da OP</p>
        <h3 className="mt-1 text-lg font-bold text-white">Informe o total recebido</h3>
        <p className="mt-1 text-sm text-slate-400">O valor deve representar todas as peças recebidas desta OP/peça. O sistema preservará a origem de cada NEST.</p>
      </div>

      <label className="block">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-200">Total recebido da OP</span>
        <input name="quantidadeRecebida" type="number" min="0" max={necessaria} step="1" value={recebidas} onChange={(event) => setRecebidas(event.target.value)} required className="mt-1 min-h-14 w-full rounded-xl border border-amber-400/30 bg-slate-950/35 px-3 text-2xl font-bold text-white outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300/30" />
      </label>

      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <Resumo titulo="Quantidade da OP" valor={necessaria} cor="text-white" />
        <Resumo titulo="Já liberado" valor={totalLiberado} cor="text-emerald-200" />
        <Resumo titulo="Falta nesta conferência" valor={falta} cor="text-rose-200" />
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-950/25 p-3 text-xs text-slate-400">
        Declarado pelos operadores: <strong className="text-slate-200">{totalDeclarado}</strong> peças · perdas informadas pelo operador: <strong className="text-amber-200">{totalPerdasDeclaradas}</strong>.
        {totalPerdasDeclaradas > 0 && <span className="mt-1 block text-cyan-200">Se a falta já estiver registrada pelo operador, ela será identificada no mesmo registro sem criar reposição duplicada.</span>}
      </div>

      {falta > 0 && <p className="rounded-lg border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100">A quantidade está abaixo do total da OP. Ao confirmar, a falta será enviada para a reposição e ficará identificada como conferência.</p>}

      <label className="block">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Motivo da divergência ou observação</span>
        <textarea name="motivoConferencia" value={motivo} onChange={(event) => setMotivo(event.target.value)} rows={2} placeholder="Observação opcional" className="mt-1 w-full resize-none rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-300" />
      </label>

      <button type="submit" name="acaoConferencia" value={acaoConferencia} disabled={pendente} className={`min-h-13 w-full rounded-xl px-4 py-3 text-sm font-black text-slate-950 transition disabled:cursor-wait disabled:opacity-60 ${falta > 0 ? "bg-rose-300 hover:bg-rose-200" : "bg-amber-300 hover:bg-amber-200"}`}>
        {pendente ? "Salvando conferência..." : falta > 0 ? `Registrar falta e liberar ${quantidadeValida} peças` : "Confirmar recebimento total"}
      </button>

      {(erroLocal || (resultado && !resultado.ok)) && <p role="alert" className="rounded-lg border border-rose-300/25 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">{erroLocal || (resultado && !resultado.ok ? resultado.mensagem : "")}</p>}
    </form>
  );
}

function Resumo({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) {
  return <div className="rounded-lg border border-slate-700 bg-slate-950/25 px-3 py-2.5"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-1 text-lg font-black ${cor}`}>{new Intl.NumberFormat("pt-BR").format(valor)}</p></div>;
}
