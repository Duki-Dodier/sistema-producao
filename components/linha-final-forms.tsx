"use client";

import { useActionState } from "react";
import {
  enviarParaEstoque,
  liberarParaMontagem,
  registrarMontagem,
  salvarFechamentoPintura,
  type LinhaFinalState,
} from "@/lib/actions/linha-final";
import { SubmitButton } from "@/components/submit-button";

const ESTADO_INICIAL: LinhaFinalState = {};
const CAMPO =
  "w-full rounded-md border border-white/10 bg-[#111a27] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-blue-500";

function Retorno({ estado }: { estado: LinhaFinalState }) {
  if (estado.error) {
    return <p className="text-xs font-medium text-rose-300">{estado.error}</p>;
  }
  if (estado.success) {
    return <p className="text-xs font-medium text-emerald-300">{estado.success}</p>;
  }
  return null;
}

export function FechamentoPinturaForm({
  data,
  quantidadeBrucke = 0,
  quantidadeReforcel = 0,
  refugoBrucke = 0,
  refugoReforcel = 0,
}: {
  data: string;
  quantidadeBrucke?: number;
  quantidadeReforcel?: number;
  refugoBrucke?: number;
  refugoReforcel?: number;
}) {
  const [estado, action] = useActionState(salvarFechamentoPintura, ESTADO_INICIAL);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Data
          <input name="data" type="date" required defaultValue={data} className={CAMPO} />
        </label>
        <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Brucke pintados
          <input name="quantidadeBrucke" type="number" min="0" step="1" required defaultValue={quantidadeBrucke} className={CAMPO} />
        </label>
        <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Reforcel pintados
          <input name="quantidadeReforcel" type="number" min="0" step="1" required defaultValue={quantidadeReforcel} className={CAMPO} />
        </label>
        <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Refugo Brucke
          <input name="refugoBrucke" type="number" min="0" step="1" required defaultValue={refugoBrucke} className={CAMPO} />
        </label>
        <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Refugo Reforcel
          <input name="refugoReforcel" type="number" min="0" step="1" required defaultValue={refugoReforcel} className={CAMPO} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Salvando fechamento...">Salvar fechamento do dia</SubmitButton>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

type Movimento = "LIBERAR" | "MONTAR" | "ESTOQUE";

export function MovimentoLinhaFinalForm({
  opId,
  saldo,
  movimento,
}: {
  opId: number;
  saldo: number;
  movimento: Movimento;
}) {
  const action = movimento === "LIBERAR"
    ? liberarParaMontagem.bind(null, opId)
    : movimento === "MONTAR"
      ? registrarMontagem.bind(null, opId)
      : enviarParaEstoque.bind(null, opId);
  const [estado, formAction] = useActionState(action, ESTADO_INICIAL);
  const rotulo = movimento === "LIBERAR"
    ? "Liberar para Montagem"
    : movimento === "MONTAR"
      ? "Confirmar montagem"
      : "Enviar ao Estoque";

  if (saldo <= 0) {
    return <p className="text-xs font-medium text-amber-300">Sem saldo disponível para registrar.</p>;
  }

  return (
    <form action={formAction} className="flex min-w-[220px] flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          name="quantidade"
          type="number"
          min="1"
          max={saldo}
          step="1"
          required
          defaultValue={saldo}
          placeholder="Quantidade"
          className={`${CAMPO} min-w-0 flex-1`}
        />
        <SubmitButton
          pendingText="Registrando..."
          className="whitespace-nowrap px-3 py-2.5 text-xs"
        >
          {rotulo}
        </SubmitButton>
      </div>
      <Retorno estado={estado} />
    </form>
  );
}
