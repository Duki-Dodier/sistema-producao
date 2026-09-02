"use client";

import { useRef } from "react";

type DateFilterProps = {
  name: string;
  label: string;
  defaultValue?: string;
  inputClassName: string;
};

export function DateFilter({ name, label, defaultValue, inputClassName }: DateFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function abrirCalendario() {
    const input = inputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // Alguns navegadores só permitem abrir o calendário pelo ícone nativo.
      }
    }

    input.focus();
  }

  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <input
        ref={inputRef}
        name={name}
        type="date"
        defaultValue={defaultValue}
        autoComplete="off"
        title="Clique para abrir o calendário"
        onClick={abrirCalendario}
        className={inputClassName}
      />
    </label>
  );
}
