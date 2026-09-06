"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { registrarEventoNestSeguro, type ResultadoEventoNest } from "@/lib/actions/nests";

const ESTADO_INICIAL: ResultadoEventoNest | null = null;

export function PlasmaEventForm({
  nestId,
  status,
  podeFinalizar,
  quantidadePendente,
}: {
  nestId: number;
  status: "PROGRAMADO" | "EM_CORTE" | "PAUSADO";
  podeFinalizar: boolean;
  quantidadePendente: number;
}) {
  const router = useRouter();
  const [resultado, acao, pendente] = useActionState(registrarEventoNestSeguro, ESTADO_INICIAL);

  useEffect(() => {
    if (!resultado?.ok) return;
    if (resultado.tipo === "FIM" || resultado.tipo === "CANCELAMENTO") {
      router.replace(`/plasma/operar/${nestId}?finalizado=1`);
      return;
    }
    router.refresh();
  }, [nestId, resultado, router]);

  return (
    <form action={acao} className="mt-3 space-y-2">
      <input type="hidden" name="nestId" value={nestId} />
      {status === "PROGRAMADO" && (
        <BotaoEvento tipo="INICIO" texto={pendente ? "Iniciando..." : "Iniciar corte"} className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" disabled={pendente} />
      )}
      {status === "EM_CORTE" && (
        <div className="grid grid-cols-2 gap-2">
          <BotaoEvento tipo="PAUSA" texto={pendente ? "Aguarde..." : "Pausar"} className="border border-amber-300/40 text-amber-200 hover:bg-amber-300/10" disabled={pendente} />
          {podeFinalizar ? <BotaoEvento tipo="FIM" texto={pendente ? "Finalizando..." : "Finalizar corte"} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" disabled={pendente} /> : <PendenteFinalizacao quantidade={quantidadePendente} />}
        </div>
      )}
      {status === "PAUSADO" && (
        <div className="grid grid-cols-2 gap-2">
          <BotaoEvento tipo="RETORNO" texto={pendente ? "Aguarde..." : "Retomar"} className="border border-emerald-300/40 text-emerald-200 hover:bg-emerald-300/10" disabled={pendente} />
          {podeFinalizar ? <BotaoEvento tipo="FIM" texto={pendente ? "Finalizando..." : "Finalizar corte"} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" disabled={pendente} /> : <PendenteFinalizacao quantidade={quantidadePendente} />}
        </div>
      )}
      {resultado && !resultado.ok && (
        <div role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">
          <p>{resultado.mensagem}</p>
          {resultado.mensagem.includes("boas e perdas") && (
            <Link href={`/plasma/apontar/${nestId}`} className="mt-2 inline-block font-bold text-amber-200 underline underline-offset-2">
              Abrir apontamento do Plasma →
            </Link>
          )}
        </div>
      )}
    </form>
  );
}

function PendenteFinalizacao({ quantidade }: { quantidade: number }) {
  return <p className="col-span-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-3 text-center text-xs font-semibold leading-relaxed text-amber-100">Registre mais {quantidade} peça(s) em boas ou perdas para finalizar.</p>;
}

function BotaoEvento({
  tipo,
  texto,
  className,
  disabled,
}: {
  tipo: string;
  texto: string;
  className: string;
  disabled: boolean;
}) {
  return (
    <button
      type="submit"
      name="tipo"
      value={tipo}
      disabled={disabled}
      className={`min-h-12 w-full rounded-xl border px-3 py-3 text-sm font-bold transition disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {texto}
    </button>
  );
}
