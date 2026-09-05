"use client";

import { useEffect, useState } from "react";

function formatar(segundos: number) {
  return [Math.floor(segundos / 3600), Math.floor((segundos % 3600) / 60), segundos % 60]
    .map(item => String(item).padStart(2, "0")).join(":");
}

export function TempoOperacao({ segundosIniciais, rodando }: { segundosIniciais: number; rodando: boolean }) {
  const [incremento, setIncremento] = useState(0);
  useEffect(() => {
    if (!rodando) return;
    const intervalo = window.setInterval(() => setIncremento(valor => valor + 1), 1000);
    return () => window.clearInterval(intervalo);
  }, [rodando]);
  const segundos = segundosIniciais + incremento;
  return <span className="font-mono tabular-nums" aria-label={`Tempo efetivo ${formatar(segundos)}`}>{formatar(segundos)}</span>;
}
