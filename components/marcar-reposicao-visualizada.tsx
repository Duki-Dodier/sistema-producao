"use client";

import { useEffect, useRef } from "react";
import { reconhecerReposicaoPlasma } from "@/lib/actions/nests";

export function MarcarReposicaoVisualizada({ eventoId }: { eventoId: number | null }) {
  const enviado = useRef<number | null>(null);

  useEffect(() => {
    if (!eventoId || enviado.current === eventoId) return;
    enviado.current = eventoId;
    const dados = new FormData();
    dados.set("eventoId", String(eventoId));
    void reconhecerReposicaoPlasma(dados).catch(() => undefined);
  }, [eventoId]);

  return null;
}
