import Link from "next/link";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { buscarDemandaPlasma } from "@/lib/plasma-saldo";
import { ehSetor } from "@/lib/setores";
import { prisma } from "@/lib/prisma";

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

export default async function PlasmaReposicaoPage() {
  const usuario = await buscarOperadorLogado();
  const setores = (await prisma.setor.findMany({ select: { id: true, nome: true } }))
    .filter((setor) => ehSetor(setor.nome, "Plasma Chapa") || ehSetor(setor.nome, "Plasma Tubo"));
  const setorPlasmaChapa = setores.find((setor) => ehSetor(setor.nome, "Plasma Chapa"));
  const setorIds = setores.map((setor) => setor.id);
  const demanda = await buscarDemandaPlasma();
  const reposicoes = demanda.filter((item) => item.setorId === setorPlasmaChapa?.id && item.reposicao > 0);
  const totalReposicao = reposicoes.reduce((soma, item) => soma + item.reposicao, 0);
  const podeProgramar = Boolean(
    usuario && (usuario.administrador || usuario.papel === "PCP" || (["LIDER", "OPERADOR"].includes(usuario.papel) && setorIds.includes(usuario.setorId))),
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/plasma" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para o painel Plasma</Link>
          <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">Plasma · programação</p>
          <h1 className="mt-1 text-2xl font-bold uppercase text-white">REPOSIÇÃO</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">Consolide as peças perdidas no Plasma e programe todas as reposições juntas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeProgramar && <Link href="/plasma/novo?reposicao=1" className="rounded bg-rose-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-950 transition hover:bg-rose-200">Programar reposições</Link>}
          <Link href="/plasma" className="rounded border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Ver painel Plasma</Link>
        </div>
      </header>

      <section className="rounded-xl border border-rose-400/25 bg-[#202a36] shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-400/15 px-4 py-4 sm:px-5">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300">Fila de reposição do Plasma Chapa</p>
            <h2 className="mt-1 text-lg font-bold text-rose-100">Peças perdidas para repor</h2>
            <p className="mt-1 text-sm text-slate-400">Perdas conferidas agrupadas por peça, OP e lote para uma nova programação.</p>
          </div>
          <div className="text-right"><strong className="block text-3xl text-rose-200">{numero(totalReposicao)}</strong><span className="text-xs text-slate-500">peças a repor</span></div>
        </div>
        <div className="divide-y divide-slate-700/70">
          {reposicoes.map((item) => (
            <div key={`${item.setorId}:${item.referencia}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div>
                <strong className="text-slate-100">{item.codigo}</strong>
                <span className="ml-2 text-sm text-slate-400">{item.nome}</span>
                <p className="mt-1 text-xs text-slate-500">{item.opLabel}{item.medida ? ` · ${item.medida}` : ""}</p>
              </div>
              <strong className="text-rose-200">{numero(item.reposicao)} a repor</strong>
            </div>
          ))}
          {!reposicoes.length && <p className="px-4 py-12 text-center text-sm text-slate-500">Nenhuma perda pendente de reposição no Plasma Chapa.</p>}
        </div>
        {podeProgramar && reposicoes.length > 0 && <div className="border-t border-slate-700 p-4"><Link href="/plasma/novo?reposicao=1" className="block rounded bg-rose-300 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-950 transition hover:bg-rose-200">Programar todas as reposições juntas</Link></div>}
      </section>
    </div>
  );
}
