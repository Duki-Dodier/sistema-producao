"use client";

import { useActionState, useRef, useState } from "react";
import { updateStatusOP, type OPActionState } from "@/lib/actions/ops";
import { STATUS_OP_LABEL } from "@/lib/labels";

const ESTADO_INICIAL: OPActionState = {};

const ESTILO_STATUS: Record<string, string> = {
  ABERTA: "border-cyan-300/50 bg-cyan-400/10 text-cyan-200 focus:border-cyan-200",
  CONCLUIDA: "border-emerald-300/50 bg-emerald-400/10 text-emerald-200 focus:border-emerald-200",
  CANCELADA: "border-red-300/50 bg-red-400/10 text-red-200 focus:border-red-200",
};

export function StatusSelect({
  opId,
  status,
}: {
  opId: number;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [valor, setValor] = useState(status);
  const [state, formAction, pending] = useActionState(updateStatusOP, ESTADO_INICIAL);

  return (
    <form ref={formRef} action={formAction} className="flex min-w-32 flex-col items-start gap-1">
      <input type="hidden" name="id" value={opId} />
      <select
        name="status"
        value={state.error ? status : valor}
        disabled={pending}
        aria-label={`Status da OP ${opId}`}
        onChange={(event) => {
          setValor(event.target.value);
          formRef.current?.requestSubmit();
        }}
        className={`w-full rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide shadow-sm outline-none transition disabled:cursor-wait disabled:opacity-60 ${ESTILO_STATUS[valor] ?? "border-slate-500 bg-slate-700 text-slate-200"}`}
      >
        {Object.entries(STATUS_OP_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {pending && <span className="text-[10px] text-slate-500">Salvando...</span>}
      {state.error && <span role="alert" className="max-w-40 text-[10px] leading-tight text-red-300">{state.error}</span>}
    </form>
  );
}
