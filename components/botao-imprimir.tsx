"use client";

export function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-[#3B82F6] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-500"
    >
      Imprimir / PDF
    </button>
  );
}
