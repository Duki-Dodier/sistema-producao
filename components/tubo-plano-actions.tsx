"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  cancelarPlanoCorteTuboSeguro,
  concluirPlanoCorteTuboSeguro,
  emitirPlanoCorteTuboSeguro,
  type ResultadoAcaoPlanoTubo,
} from "@/lib/actions/tubo-plano-corte";

const inicial: ResultadoAcaoPlanoTubo | null = null;

function Aviso({ estado }: { estado: ResultadoAcaoPlanoTubo | null }) {
  if (!estado) return null;
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${estado.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-rose-400/30 bg-rose-400/10 text-rose-200"}`}>{estado.mensagem}</div>;
}

export function EmitirPlanoTubo({ parametros, maquinaId, desabilitado }: {
  parametros: { perdaCorteMm: number; margemInicialMm: number; margemFinalMm: number; minimoSobraMm: number };
  maquinaId: number | null;
  desabilitado: boolean;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState(emitirPlanoCorteTuboSeguro, inicial);
  useEffect(() => {
    if (estado?.ok && estado.id) router.push(`/tubo/plano-corte/${estado.id}`);
  }, [estado, router]);
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="maquinaId" value={maquinaId ?? ""} />
      {Object.entries(parametros).map(([nome, valor]) => <input key={nome} type="hidden" name={nome} value={valor} />)}
      <button disabled={desabilitado || pendente} className="w-full rounded-lg bg-cyan-400 px-5 py-3 font-mono text-xs font-black uppercase tracking-wider text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
        {pendente ? "Emitindo plano..." : "Emitir plano e reservar demanda"}
      </button>
      <Aviso estado={estado} />
    </form>
  );
}

export function AcoesPlanoTubo({ planoId, barras, podeGerenciar, podeConcluir }: {
  planoId: number;
  barras: Array<{ id: number; ordem: number; sobraPrevistaMm: number }>;
  podeGerenciar: boolean;
  podeConcluir: boolean;
}) {
  const router = useRouter();
  const [estadoConclusao, acaoConclusao, concluindo] = useActionState(concluirPlanoCorteTuboSeguro, inicial);
  const [estadoCancelamento, acaoCancelamento, cancelando] = useActionState(cancelarPlanoCorteTuboSeguro, inicial);
  useEffect(() => {
    if (estadoConclusao?.ok || estadoCancelamento?.ok) router.refresh();
  }, [estadoConclusao, estadoCancelamento, router]);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      {podeConcluir && (
        <form action={acaoConclusao} className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4">
          <input type="hidden" name="planoId" value={planoId} />
          <p className="mb-3 font-mono text-xs font-black uppercase tracking-wider text-emerald-300">Confirmar sobras reais</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {barras.map((barra) => (
              <label key={barra.id} className="text-xs text-slate-400">Barra {barra.ordem}
                <input name={`sobraReal-${barra.id}`} type="number" min="0" step="0.1" defaultValue={barra.sobraPrevistaMm} required className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
            ))}
          </div>
          <button disabled={concluindo} className="mt-4 rounded-lg bg-emerald-400 px-5 py-2.5 font-mono text-xs font-black uppercase text-slate-950 disabled:opacity-50">{concluindo ? "Concluindo..." : "Concluir plano"}</button>
          <div className="mt-3"><Aviso estado={estadoConclusao} /></div>
        </form>
      )}
      {podeGerenciar && (
        <form action={acaoCancelamento} className="self-end">
          <input type="hidden" name="planoId" value={planoId} />
          <button disabled={cancelando} className="rounded-lg border border-rose-400/40 px-5 py-2.5 font-mono text-xs font-black uppercase text-rose-300 disabled:opacity-50">{cancelando ? "Cancelando..." : "Cancelar plano"}</button>
          <div className="mt-3"><Aviso estado={estadoCancelamento} /></div>
        </form>
      )}
    </div>
  );
}
