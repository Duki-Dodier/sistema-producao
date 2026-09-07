import { nomePerfilTubo } from "@/lib/tubo-plano-corte";

export type BarraTuboExibicao = {
  id?: number;
  ordem: number;
  perfilA: number;
  perfilB: number | null;
  espessuraMm: number;
  origem: string;
  sobraOrigemCodigo?: string | null;
  comprimentoOrigemMm: number;
  sobraPrevistaMm: number;
  aproveitamentoPct: number;
  itens: Array<{
    opNumero: number;
    lote: string;
    modelo: string;
    pecaCodigo: string;
    pecaNome: string;
    quantidade: number;
    comprimentoMm: number;
  }>;
};

const CORES = ["bg-cyan-400", "bg-sky-400", "bg-emerald-400", "bg-amber-300", "bg-violet-400", "bg-rose-400"];

export function TuboBarrasPlano({ barras }: { barras: BarraTuboExibicao[] }) {
  const grupos = new Map<string, BarraTuboExibicao[]>();
  for (const barra of barras) {
    const perfil = nomePerfilTubo(barra.perfilA, barra.perfilB, barra.espessuraMm);
    grupos.set(perfil, [...(grupos.get(perfil) ?? []), barra]);
  }
  return (
    <div className="space-y-6">
      {[...grupos.entries()].map(([perfil, itensGrupo]) => (
        <section key={perfil} className="overflow-hidden rounded-xl border border-slate-700/80 bg-[#111c2e]">
          <div className="border-b border-slate-700/80 px-4 py-3">
            <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Perfil {perfil}</p>
            <p className="mt-1 text-xs text-slate-500">{itensGrupo.length} barra(s) nesta medida</p>
          </div>
          <div className="space-y-4 p-4">
            {itensGrupo.map((barra) => (
              <article key={barra.id ?? barra.ordem} className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-white">BARRA {String(barra.ordem).padStart(3, "0")}</strong>
                    <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${barra.origem === "SOBRA" ? "border-emerald-400/40 text-emerald-300" : "border-cyan-400/40 text-cyan-300"}`}>
                      {barra.origem === "SOBRA" ? `SOBRA ${barra.sobraOrigemCodigo ?? "REAPROVEITADA"}` : "BARRA NOVA 6.000 MM"}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-300">{barra.aproveitamentoPct.toFixed(1)}% · sobra {barra.sobraPrevistaMm.toFixed(1)} mm</span>
                </div>
                <div className="flex h-11 overflow-hidden rounded-md border border-slate-700 bg-slate-900" title={`${barra.comprimentoOrigemMm} mm`}>
                  {barra.itens.map((item, indice) => {
                    const largura = Math.max((item.quantidade * item.comprimentoMm / barra.comprimentoOrigemMm) * 100, 1.5);
                    return <div key={`${item.pecaCodigo}-${indice}`} style={{ width: `${largura}%` }} className={`flex min-w-0 items-center justify-center border-r border-slate-950 px-1 ${CORES[indice % CORES.length]}`} title={`${item.quantidade} × ${item.pecaCodigo} · ${item.comprimentoMm} mm`}><span className="truncate font-mono text-[10px] font-black text-slate-950">{item.quantidade}× {item.pecaCodigo}</span></div>;
                  })}
                  {barra.sobraPrevistaMm > 0 && <div className="flex min-w-[2px] flex-1 items-center justify-center bg-slate-800"><span className="truncate px-1 font-mono text-[9px] text-slate-500">SOBRA</span></div>}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="font-mono uppercase tracking-wider text-slate-500"><tr><th className="pb-2">Sequência</th><th className="pb-2">OP / lote</th><th className="pb-2">Peça</th><th className="pb-2 text-right">Qtde.</th><th className="pb-2 text-right">Comprimento</th></tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {barra.itens.map((item, indice) => <tr key={`${item.pecaCodigo}-${indice}`}><td className="py-2 font-mono text-cyan-300">{indice + 1}</td><td className="py-2 text-slate-300">OP {item.opNumero} · {item.lote}</td><td className="py-2"><strong className="text-white">{item.pecaCodigo}</strong><span className="ml-2 text-slate-500">{item.pecaNome}</span></td><td className="py-2 text-right font-mono text-white">{item.quantidade}</td><td className="py-2 text-right font-mono text-white">{item.comprimentoMm.toFixed(1)} mm</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
