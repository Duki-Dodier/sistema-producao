import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { exigirUsuarioLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { planoCorteTuboInclude } from "@/lib/plano-corte-tubos-dados";

export const dynamic = "force-dynamic";

function numero(valor: number, casas = 0) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export default async function PlanoCorteTubosDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuarioLogado();
  if (!usuario.administrador && usuario.papel !== "PCP") redirect("/");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const plano = await prisma.planoCorteTubo.findUnique({ where: { id }, include: planoCorteTuboInclude });
  if (!plano) notFound();
  const ops = [...new Map(plano.padroes.flatMap((padrao) => padrao.itens).map((item) => [`${item.opNumero}:${item.lote}`, item])).values()]
    .sort((a, b) => a.opNumero - b.opNumero || a.lote.localeCompare(b.lote, "pt-BR"));

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/pcp/plano-corte-tubos" className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-100">← Voltar ao planejamento</Link>
          <p className="mt-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Documento orientativo do PCP</p>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">{plano.codigo}</h1>
          <p className="mt-2 text-sm text-slate-400">Emitido por <b className="text-slate-200">{plano.criadoPor.nome}</b> em {plano.emitidoEm.toLocaleString("pt-BR")}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <a href={`/pcp/plano-corte-tubos/${plano.id}/pdf`} className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300"><Download className="h-4 w-4" />Baixar PDF</a>
        </div>
      </header>

      <section className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100">
        Este plano não reserva material, não altera as OPs e não comprova produção. Ele registra a melhor sequência calculada no momento da emissão.
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Indicador rotulo="OPs" valor={numero(plano.totalOps)} />
        <Indicador rotulo="Peças" valor={numero(plano.totalPecas)} />
        <Indicador rotulo="Padrões" valor={numero(plano.totalPadroes)} />
        <Indicador rotulo="Barras de 6 m" valor={numero(plano.totalBarras)} destaque />
        <Indicador rotulo="Metros úteis" valor={`${numero(plano.comprimentoPecasMm / 1000, 2)} m`} />
        <Indicador rotulo="Perda da serra" valor={`${numero(plano.perdaCortesTotalMm / 1000, 2)} m`} />
        <Indicador rotulo="Sobra prevista" valor={`${numero(plano.sobraTotalMm / 1000, 2)} m`} />
        <Indicador rotulo="Aproveitamento" valor={`${numero(plano.aproveitamentoPct, 1)}%`} destaque />
      </section>

      <section className="grid gap-3 rounded-xl border border-slate-700 bg-[#111c2e] p-4 sm:grid-cols-3">
        <Dado rotulo="Comprimento da barra" valor={`${numero(plano.comprimentoBarraMm)} mm`} />
        <Dado rotulo="Perda por corte" valor={`${numero(plano.perdaCorteMm, plano.perdaCorteMm % 1 ? 1 : 0)} mm`} />
        <Dado rotulo="Refile inicial" valor={`${numero(plano.refileInicialMm, plano.refileInicialMm % 1 ? 1 : 0)} mm`} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#111c2e]">
        <header className="border-b border-slate-700 px-4 py-3"><h2 className="font-mono text-xs font-black uppercase tracking-[0.16em] text-white">OPs presentes no plano</h2></header>
        <div className="flex flex-wrap gap-2 p-4">{ops.map((op) => <span key={`${op.opNumero}:${op.lote}`} className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100"><b>OP {op.opNumero}</b> · {op.lote} · {op.modeloCodigo}</span>)}</div>
      </section>

      <section className="space-y-3">
        {plano.padroes.map((padrao) => (
          <article key={padrao.id} className="overflow-hidden rounded-xl border border-slate-700 bg-[#111c2e]">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-[#152338] px-4 py-3">
              <div><p className="font-mono text-xs font-black text-cyan-300">{padrao.codigo} · TUBO {numero(padrao.perfilMm)}×{numero(padrao.perfilMm)}×{numero(padrao.espessuraMm, padrao.espessuraMm % 1 ? 1 : 0)} MM</p><h2 className="mt-1 text-lg font-black text-white">REPETIR EM {padrao.repeticoes} BARRA(S)</h2></div>
              <div className="text-right"><strong className="text-lg text-emerald-300">{numero(padrao.aproveitamentoPct, 1)}%</strong><p className="text-xs text-slate-500">sobra {numero(padrao.sobraPorBarraMm, 1)} mm por barra</p></div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-950/35 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Seq.</th><th className="px-4 py-3">OP / lote</th><th className="px-4 py-3">Modelo</th><th className="px-4 py-3">Peça</th><th className="px-4 py-3 text-right">Comprimento</th><th className="px-4 py-3 text-right">Por barra</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
                <tbody>{padrao.itens.map((item, indice) => <tr key={item.id} className="border-t border-slate-700/60"><td className="px-4 py-3 font-mono text-cyan-300">{indice + 1}</td><td className="px-4 py-3"><b className="text-white">OP {item.opNumero}</b><p className="text-xs text-slate-500">{item.lote}</p></td><td className="px-4 py-3 text-slate-300">{item.modeloCodigo}</td><td className="px-4 py-3"><b className="text-white">{item.pecaCodigo}</b><p className="text-xs text-slate-500">{item.pecaNome}</p></td><td className="px-4 py-3 text-right text-slate-300">{numero(item.comprimentoUnitarioMm, item.comprimentoUnitarioMm % 1 ? 1 : 0)} mm</td><td className="px-4 py-3 text-right font-bold text-amber-200">{item.quantidadePorBarra}</td><td className="px-4 py-3 text-right font-bold text-emerald-300">{item.quantidadeTotal}</td></tr>)}</tbody>
              </table>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function Indicador({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return <div className={`rounded-xl border p-3 ${destaque ? "border-cyan-300/35 bg-cyan-400/10" : "border-slate-700 bg-[#111c2e]"}`}><p className="text-xs font-semibold text-slate-500">{rotulo}</p><strong className={`mt-1 block text-xl ${destaque ? "text-cyan-200" : "text-white"}`}>{valor}</strong></div>;
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div><p className="text-xs font-semibold text-slate-500">{rotulo}</p><strong className="mt-1 block text-lg text-white">{valor}</strong></div>;
}
