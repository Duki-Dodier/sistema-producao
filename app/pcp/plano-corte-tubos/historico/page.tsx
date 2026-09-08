import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { exigirUsuarioLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const POR_PAGINA = 25;

function paginaValida(valor: string | string[] | undefined) {
  const numero = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(numero) && numero > 0 ? numero : 1;
}

function numero(valor: number, casas = 0) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export default async function HistoricoPlanoCorteTubosPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string | string[] }>;
}) {
  const usuario = await exigirUsuarioLogado();
  if (!usuario.administrador && usuario.papel !== "PCP") redirect("/");

  const paginaSolicitada = paginaValida((await searchParams).pagina);
  const total = await prisma.planoCorteTubo.count();
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(paginaSolicitada, totalPaginas);
  const planos = await prisma.planoCorteTubo.findMany({
    orderBy: [{ emitidoEm: "desc" }, { id: "desc" }],
    skip: (pagina - 1) * POR_PAGINA,
    take: POR_PAGINA,
    include: { criadoPor: { select: { nome: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-6">
      <header>
        <Link href="/pcp/plano-corte-tubos" className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-100">← Voltar ao planejamento</Link>
        <p className="mt-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Planejamento do PCP</p>
        <h1 className="mt-1 text-2xl font-black uppercase text-white sm:text-3xl">Histórico de planos de corte</h1>
        <p className="mt-2 text-sm text-slate-400">Cada registro preserva os dados e o resultado exatos do momento da emissão.</p>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#111c2e]">
        <div className="grid grid-cols-[1.4fr_1fr_repeat(4,0.65fr)_auto] gap-3 border-b border-slate-700 bg-slate-950/30 px-4 py-3 text-xs font-bold uppercase text-slate-500 max-lg:hidden">
          <span>Plano</span><span>Responsável</span><span>OPs</span><span>Barras</span><span>Peças</span><span>Aproveit.</span><span>Ações</span>
        </div>
        {planos.length ? planos.map((plano) => (
          <div key={plano.id} className="grid gap-3 border-b border-slate-700/60 px-4 py-4 last:border-0 lg:grid-cols-[1.4fr_1fr_repeat(4,0.65fr)_auto] lg:items-center">
            <div><b className="text-cyan-200">{plano.codigo}</b><p className="mt-0.5 text-xs text-slate-500">{plano.emitidoEm.toLocaleString("pt-BR")}</p></div>
            <span className="text-sm text-slate-300">{plano.criadoPor.nome}</span>
            <DadoMovel rotulo="OPs" valor={numero(plano.totalOps)} />
            <DadoMovel rotulo="Barras" valor={numero(plano.totalBarras)} />
            <DadoMovel rotulo="Peças" valor={numero(plano.totalPecas)} />
            <DadoMovel rotulo="Aproveitamento" valor={`${numero(plano.aproveitamentoPct, 1)}%`} destaque />
            <div className="flex gap-2">
              <Link href={`/pcp/plano-corte-tubos/${plano.id}`} className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-300/10"><FileText className="h-4 w-4" />Abrir</Link>
              <a href={`/pcp/plano-corte-tubos/${plano.id}/pdf`} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold text-slate-200 hover:border-slate-400">PDF</a>
            </div>
          </div>
        )) : <p className="p-10 text-center text-sm text-slate-500">Nenhum plano emitido.</p>}
      </section>

      {totalPaginas > 1 && (
        <nav aria-label="Paginação do histórico" className="flex items-center justify-center gap-3">
          <Link aria-disabled={pagina === 1} href={`?pagina=${Math.max(1, pagina - 1)}`} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-bold ${pagina === 1 ? "pointer-events-none border-slate-800 text-slate-700" : "border-slate-600 text-white hover:border-cyan-300"}`}><ChevronLeft className="h-4 w-4" />Anterior</Link>
          <span className="text-sm text-slate-400">Página <b className="text-white">{pagina}</b> de {totalPaginas}</span>
          <Link aria-disabled={pagina === totalPaginas} href={`?pagina=${Math.min(totalPaginas, pagina + 1)}`} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-bold ${pagina === totalPaginas ? "pointer-events-none border-slate-800 text-slate-700" : "border-slate-600 text-white hover:border-cyan-300"}`}>Próxima<ChevronRight className="h-4 w-4" /></Link>
        </nav>
      )}
    </main>
  );
}

function DadoMovel({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return <span className={`text-sm font-bold ${destaque ? "text-emerald-300" : "text-white"}`}><small className="mr-1 font-normal text-slate-500 lg:hidden">{rotulo}:</small>{valor}</span>;
}
