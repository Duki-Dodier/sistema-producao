"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarEventoNestSeguro, type ResultadoEventoNest } from "@/lib/actions/nests";

const ESTADO_INICIAL: ResultadoEventoNest | null = null;

export type FaltaNestItem = {
  pecaCodigo: string;
  pecaNome?: string;
  opNumero: number;
  lote: string | null;
  planejado: number;
  boas: number;
  perdas: number;
  falta: number;
};

export function PlasmaEventForm({
  nestId,
  status,
  podeFinalizar,
  quantidadePendente,
  faltas,
  plasmaChapa = false,
  rotaDepoisFinalizar,
  mostrarDescricao = false,
}: {
  nestId: number;
  status: "PROGRAMADO" | "EM_CORTE" | "PAUSADO";
  podeFinalizar: boolean;
  quantidadePendente: number;
  faltas: FaltaNestItem[];
  plasmaChapa?: boolean;
  rotaDepoisFinalizar?: string;
  mostrarDescricao?: boolean;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, acao, pendente] = useActionState(registrarEventoNestSeguro, ESTADO_INICIAL);
  const faltasVisiveis = faltas.filter((item) => item.falta > 0);
  const totalFaltas = faltasVisiveis.reduce((total, item) => total + item.falta, 0);

  useEffect(() => {
    if (!resultado?.ok) return;
    if (resultado.tipo === "FIM" || resultado.tipo === "CANCELAMENTO") {
      const destino = rotaDepoisFinalizar ?? `/plasma/operar/${nestId}`;
      const separador = destino.includes("?") ? "&" : "?";
      router.replace(`${destino}${separador}finalizado=1&repor=${resultado.faltasEnviadas ?? 0}`);
      return;
    }
    router.refresh();
  }, [nestId, resultado, rotaDepoisFinalizar, router]);

  return (
    <form action={acao} className="mt-3 space-y-2">
      <input type="hidden" name="nestId" value={nestId} />
      {mostrarDescricao && <input name="descricao" placeholder="Motivo da pausa, troca de chapa..." className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/30 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400" />}
      {status === "PROGRAMADO" && (
        <BotaoEvento tipo="INICIO" texto={pendente ? "Iniciando..." : "Iniciar corte"} className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" disabled={pendente} />
      )}
      {status === "EM_CORTE" && (
        <div className="grid grid-cols-2 gap-2">
          <BotaoEvento tipo="PAUSA" texto={pendente ? "Aguarde..." : "Pausar"} className="border border-amber-300/40 text-amber-200 hover:bg-amber-300/10" disabled={pendente} />
          <Finalizacao
            plasmaChapa={plasmaChapa}
            podeFinalizar={podeFinalizar}
            quantidadePendente={quantidadePendente}
            confirmando={confirmando}
            setConfirmando={setConfirmando}
            faltas={faltasVisiveis}
            totalFaltas={totalFaltas}
            pendente={pendente}
          />
        </div>
      )}
      {status === "PAUSADO" && (
        <div className="grid grid-cols-2 gap-2">
          <BotaoEvento tipo="RETORNO" texto={pendente ? "Aguarde..." : "Retomar"} className="border border-emerald-300/40 text-emerald-200 hover:bg-emerald-300/10" disabled={pendente} />
          <Finalizacao
            plasmaChapa={plasmaChapa}
            podeFinalizar={podeFinalizar}
            quantidadePendente={quantidadePendente}
            confirmando={confirmando}
            setConfirmando={setConfirmando}
            faltas={faltasVisiveis}
            totalFaltas={totalFaltas}
            pendente={pendente}
          />
        </div>
      )}
      {resultado && !resultado.ok && (
        <div role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">
          <p>{resultado.mensagem}</p>
        </div>
      )}
    </form>
  );
}

function Finalizacao({
  plasmaChapa,
  podeFinalizar,
  quantidadePendente,
  confirmando,
  setConfirmando,
  faltas,
  totalFaltas,
  pendente,
}: {
  plasmaChapa: boolean;
  podeFinalizar: boolean;
  quantidadePendente: number;
  confirmando: boolean;
  setConfirmando: (valor: boolean) => void;
  faltas: FaltaNestItem[];
  totalFaltas: number;
  pendente: boolean;
}) {
  if (!plasmaChapa) {
    return podeFinalizar
      ? <BotaoEvento tipo="FIM" texto={pendente ? "Finalizando..." : "Finalizar corte"} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" disabled={pendente} />
      : <PendenteFinalizacao quantidade={quantidadePendente} />;
  }

  if (!confirmando) {
    return <button type="button" onClick={() => setConfirmando(true)} disabled={pendente} className="min-h-12 w-full rounded-xl border border-cyan-300/30 bg-cyan-400 px-3 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60">Finalizar corte</button>;
  }

  return (
    <div className="col-span-2 rounded-xl border border-amber-300/35 bg-amber-300/10 p-3">
      <p className="text-sm font-bold text-amber-100">Confirmar encerramento do corte?</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/75">O tempo será encerrado. As quantidades abaixo serão enviadas para a reposição.</p>
      {faltas.length > 0 ? (
        <div className="mt-3 space-y-2">
          {faltas.map((item) => (
            <div key={`${item.opNumero}-${item.lote ?? "sem-lote"}-${item.pecaCodigo}`} className="rounded-lg border border-amber-200/15 bg-slate-950/25 px-3 py-2 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="font-semibold text-white">{item.pecaCodigo}{item.pecaNome ? ` · ${item.pecaNome}` : ""}</p><p className="mt-0.5 text-slate-400">OP {item.opNumero} · lote {item.lote ?? "-"}</p></div>
                <strong className="shrink-0 text-rose-200">Falta {item.falta}</strong>
              </div>
              <p className="mt-1 text-slate-500">Planejado {item.planejado} · boas {item.boas} · perdas informadas {item.perdas}</p>
            </div>
          ))}
        </div>
      ) : <p className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100">Nenhuma peça faltante. O NEST será encerrado completo.</p>}
      {totalFaltas > 0 && <p className="mt-3 text-right text-sm font-black text-rose-200">Total para reposição: {totalFaltas}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setConfirmando(false)} disabled={pendente} className="min-h-11 rounded-xl border border-slate-600 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-slate-400">Voltar</button>
        <BotaoEvento tipo="FIM" texto={pendente ? "Finalizando..." : "Confirmar e finalizar"} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300" disabled={pendente} />
      </div>
    </div>
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
