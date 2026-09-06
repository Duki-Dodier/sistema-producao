import Link from "next/link";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { podeConferirPlasma } from "@/lib/plasma-regras";
import { ehSetor } from "@/lib/setores";
import { prisma } from "@/lib/prisma";

export default async function PlasmaConferenciaPage() {
  const usuario = await buscarOperadorLogado();
  const setores = (await prisma.setor.findMany({ select: { id: true, nome: true } }))
    .filter((setor) => ehSetor(setor.nome, "Plasma Chapa") || ehSetor(setor.nome, "Plasma Tubo"));
  const setorIds = setores.map((setor) => setor.id);
  const [pendenciasConferencia, conferentePlasma] = await Promise.all([
    prisma.nestLancamento.findMany({
      where: { apontamentoId: null, item: { nest: { setorId: { in: setorIds }, status: { in: ["CONCLUIDO", "CANCELADO"] } } } },
      include: { funcionario: { select: { nome: true } }, item: { include: { peca: { select: { codigo: true, nome: true } }, op: { select: { lote: true } }, nest: { select: { id: true, codigo: true, setor: { select: { nome: true } } } } } } },
      orderBy: { dataHora: "asc" },
    }),
    prisma.funcionario.findFirst({ where: { ativo: true, papel: "CONFERENTE", setor: { nome: "Plasma Chapa" } }, select: { nome: true } }),
  ]);
  const podeConferir = podeConferirPlasma(usuario);

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/plasma" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para o painel Plasma</Link>
          <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Plasma · qualidade</p>
          <h1 className="mt-1 text-2xl font-bold uppercase text-white">CONFERÊNCIA</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">Valide os resultados declarados pelo operador antes de liberar a produção para o restante da fábrica.</p>
        </div>
        <Link href="/plasma" className="rounded border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Ver painel Plasma</Link>
      </header>

      {!conferentePlasma && (
        <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/35 bg-amber-400/10 px-4 py-3">
          <div><p className="text-sm font-semibold text-amber-100">Defina o conferente único do Plasma.</p><p className="mt-0.5 text-xs text-amber-100/75">Até essa pessoa ser designada, os cortes declarados ficarão aguardando liberação.</p></div>
          {usuario?.administrador && <Link href="/configuracoes" className="rounded border border-amber-300/40 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/10">Abrir configurações</Link>}
        </section>
      )}

      <section className="rounded-xl border border-amber-400/25 bg-[#202a36] shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-400/15 px-4 py-4 sm:px-5">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">Fila de qualidade do Plasma</p>
            <h2 className="mt-1 text-lg font-bold text-amber-100">Aguardando conferência</h2>
            <p className="mt-1 text-sm text-slate-400">Só o conferente do Plasma transforma estes valores em produção oficial.</p>
          </div>
          <div className="text-right"><strong className="block text-3xl text-amber-200">{pendenciasConferencia.length}</strong><span className="text-xs text-slate-500">lançamento(s) pendente(s)</span></div>
        </div>
        <div className="divide-y divide-slate-700/70">
          {pendenciasConferencia.map((item) => (
            <Link key={item.id} href={`/plasma/${item.item.nest.id}#conferencia`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm transition hover:bg-amber-400/5 sm:px-5">
              <span>
                <strong className="text-slate-100">{item.item.nest.codigo}</strong>
                <span className="ml-2 text-slate-400">{item.item.peca.codigo} · OP {item.item.op.lote ?? "sem lote"}</span>
                <span className="mt-1 block text-xs text-slate-500">{item.item.nest.setor.nome} · {item.item.peca.nome} · declarado por {item.funcionario.nome}</span>
              </span>
              <span className="shrink-0 font-bold text-amber-200">{item.quantidadeBoa} boas / {item.quantidadeRefugo} perdas</span>
            </Link>
          ))}
          {!pendenciasConferencia.length && <p className="px-4 py-12 text-center text-sm text-slate-500">Nenhum corte aguardando conferência.</p>}
        </div>
        {pendenciasConferencia.length > 0 && <p className="border-t border-slate-700 px-4 py-3 text-xs text-slate-500 sm:px-5">{podeConferir ? "Seu usuário é o responsável por esta conferência." : conferentePlasma ? `Somente ${conferentePlasma.nome}, conferente designado, pode validar.` : "Aguardando a designação do conferente."}</p>}
      </section>
    </div>
  );
}
