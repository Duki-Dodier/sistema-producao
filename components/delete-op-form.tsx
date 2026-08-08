"use client";

import { useActionState } from "react";
import { deleteOP, type OPActionState } from "@/lib/actions/ops";

const ESTADO_INICIAL: OPActionState = {};

export function DeleteOPForm({
  opId,
  temApontamentos,
}: {
  opId: number;
  temApontamentos: boolean;
}) {
  const action = deleteOP.bind(null, opId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);
  const bloqueada = temApontamentos || pending;

  return (
    <section className="rounded-xl border border-red-400/25 bg-red-950/20 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-red-200">Zona de risco</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            A exclusão é definitiva. Para uma OP que já entrou na produção, prefira usar
            <strong className="mx-1 text-slate-200">Cancelada</strong> ou
            <strong className="mx-1 text-slate-200">Finalizada</strong> e preserve o histórico.
          </p>
        </div>

        <form
          action={formAction}
          onSubmit={(event) => {
            if (!window.confirm("Excluir esta OP definitivamente? Essa ação não pode ser desfeita.")) {
              event.preventDefault();
            }
          }}
          className="shrink-0"
        >
          <button
            type="submit"
            disabled={bloqueada}
            className="inline-flex min-w-44 items-center justify-center rounded-lg border border-red-400/50 bg-red-500/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-red-200 transition hover:border-red-300 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800/60 disabled:text-slate-500"
          >
            {pending ? "Excluindo..." : temApontamentos ? "OP com histórico" : "Excluir OP"}
          </button>
        </form>
      </div>

      {temApontamentos && (
        <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-200">
          Esta OP já possui apontamentos e está protegida contra exclusão.
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-300/25 bg-red-500/10 p-3 text-xs text-red-200">
          {state.error}
        </p>
      )}
    </section>
  );
}
