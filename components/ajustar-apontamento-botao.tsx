"use client";

import { useState } from "react";
import {
  AjusteApontamentoModal,
  type ApontamentoParaAjuste,
  type Autorizador,
} from "./ajuste-apontamento-modal";

export function AjustarApontamentoBotao({
  apontamento,
  autorizadores,
}: {
  apontamento: ApontamentoParaAjuste;
  autorizadores: Autorizador[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/20"
        title="Corrigir a quantidade deste apontamento (Líder do setor ou PCP)"
      >
        Ajustar
      </button>
      {aberto && (
        <AjusteApontamentoModal
          apontamento={apontamento}
          autorizadores={autorizadores}
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}
