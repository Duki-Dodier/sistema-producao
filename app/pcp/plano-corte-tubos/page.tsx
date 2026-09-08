import { redirect } from "next/navigation";
import Link from "next/link";
import { History } from "lucide-react";
import { PlanoCorteTubosView } from "@/components/plano-corte-tubos-view";
import { exigirUsuarioLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { buscarOpsDisponiveisPlanoCorteTubos } from "@/lib/plano-corte-tubos-dados";

export const dynamic = "force-dynamic";

export default async function PlanoCorteTubosPage() {
  const usuario = await exigirUsuarioLogado();
  if (!usuario.administrador && usuario.papel !== "PCP") redirect("/");

  const [{ ops, demandasPorOp, setorTuboId }, historico] = await Promise.all([
    buscarOpsDisponiveisPlanoCorteTubos(),
    prisma.planoCorteTubo.findMany({
      orderBy: [{ emitidoEm: "desc" }, { id: "desc" }],
      take: 25,
      select: {
        id: true,
        codigo: true,
        emitidoEm: true,
        totalOps: true,
        totalBarras: true,
        totalPecas: true,
        aproveitamentoPct: true,
        criadoPor: { select: { nome: true } },
      },
    }),
  ]);

  const demandas = [...demandasPorOp.values()].flat();

  return (
    <main className="mx-auto w-full max-w-[1760px] space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Planejamento do PCP</p>
          <h1 className="mt-1 text-2xl font-black uppercase text-white sm:text-3xl">PLANO DE CORTE — TUBOS</h1>
          <p className="mt-2 max-w-4xl text-base leading-relaxed text-slate-400">Combine peças de várias OPs em barras de 6 metros para reduzir sobras. Esta ferramenta apenas orienta o PCP e não interfere nos apontamentos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/pcp/plano-corte-tubos/historico" className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/35 px-3 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/10">
            <History className="h-4 w-4" /> Histórico de planos
          </Link>
          <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            <b>Uso exclusivo:</b> PCP e administração
          </div>
        </div>
      </header>

      {!setorTuboId ? (
        <section role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-5 text-rose-100">O setor TUBO não foi encontrado no cadastro.</section>
      ) : (
        <PlanoCorteTubosView
          ops={ops}
          demandas={demandas}
          historico={historico.map((plano) => ({
            id: plano.id,
            codigo: plano.codigo,
            emitidoEm: plano.emitidoEm.toLocaleString("pt-BR"),
            criadoPor: plano.criadoPor.nome,
            totalOps: plano.totalOps,
            totalBarras: plano.totalBarras,
            totalPecas: plano.totalPecas,
            aproveitamentoPct: plano.aproveitamentoPct,
          }))}
        />
      )}
    </main>
  );
}
