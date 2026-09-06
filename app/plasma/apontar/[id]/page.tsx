import Link from "next/link";
import { notFound } from "next/navigation";
import { registrarLancamentoNest } from "@/lib/actions/nests";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

export default async function ApontamentoPlasmaMobilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) notFound();

  const [usuario, nest] = await Promise.all([
    buscarOperadorLogado(),
    prisma.nestCorte.findUnique({
      where: { id },
      include: {
        setor: { select: { id: true, nome: true } },
        maquina: { select: { codigo: true, nome: true } },
        itens: { orderBy: { id: "asc" }, include: { op: { select: { numeroSequencia: true, lote: true } }, peca: { select: { codigo: true, nome: true } }, lancamentos: { orderBy: { dataHora: "desc" }, include: { funcionario: { select: { nome: true } } } } } },
      },
    }),
  ]);

  if (!nest) notFound();
  const acessoPlasma = Boolean(usuario && (usuario.administrador || usuario.papel === "PCP" || usuario.setorId === nest.setor.id));
  if (!acessoPlasma || !ehSetor(nest.setor.nome, "Plasma Chapa") && !ehSetor(nest.setor.nome, "Plasma Tubo")) notFound();
  const encerrado = ["CONCLUIDO", "CANCELADO"].includes(nest.status);

  return (
    <main className="min-h-full bg-[#07101f] px-3 py-4 text-slate-100 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-lg space-y-3">
        <div className="flex items-center justify-between gap-3"><Link href={`/plasma/operar/${nest.id}`} className="text-xs font-semibold text-slate-400 hover:text-cyan-200">← Operação</Link><span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">Apontamento Plasma</span></div>
        <section className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-[#3a3020] via-[#252a2d] to-[#111b2b] p-4"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">Produção do corte</p><div className="mt-1 flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black text-white">{nest.codigo}</h1><p className="mt-1 text-sm text-slate-300">{nest.setor.nome} · {nest.maquina.codigo}</p></div><span className="rounded-full border border-amber-300/30 px-2 py-1 text-[10px] font-bold uppercase text-amber-100">{nest.status}</span></div><p className="mt-3 text-xs text-amber-100/75">Registre somente o que saiu da máquina. As perdas também precisam ser informadas.</p></section>

        {encerrado && <div className="rounded-xl border border-slate-700 bg-[#111b2b] p-4 text-sm text-slate-300">Este NEST está encerrado. A conferência é realizada na tela de rastreabilidade.</div>}
        <div className="space-y-3">{nest.itens.map((item) => {
          const declarado = item.lancamentos.reduce((soma, l) => soma + l.quantidadeBoa + l.quantidadeRefugo, 0);
          const restante = Math.max(0, item.quantidadePlanejada - declarado);
          return <section key={item.id} className="rounded-2xl border border-slate-700 bg-[#111b2b] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-bold text-white">{item.peca.codigo}</p><p className="mt-1 text-xs text-slate-400">{item.peca.nome}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-cyan-300">OP {item.op.numeroSequencia} · lote {item.op.lote ?? "-"}</p></div><div className="text-right"><p className="font-mono text-[10px] uppercase text-slate-500">Restante</p><strong className="text-2xl text-cyan-100">{restante}</strong></div></div>{!encerrado && restante > 0 && <form action={registrarLancamentoNest} className="mt-4 space-y-3 border-t border-slate-700/70 pt-4"><input type="hidden" name="nestItemId" value={item.id} /><input type="hidden" name="tipo" value="PRODUCAO" /><div className="grid grid-cols-2 gap-2"><label className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-3"><span className="font-mono text-[10px] font-bold uppercase text-emerald-200">Boas</span><input name="quantidadeBoa" type="number" min="0" max={restante} defaultValue="0" required className="mt-2 w-full bg-transparent text-2xl font-black text-white outline-none" /></label><label className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-3"><span className="font-mono text-[10px] font-bold uppercase text-rose-200">Perdas</span><input name="quantidadeRefugo" type="number" min="0" max={restante} defaultValue="0" required className="mt-2 w-full bg-transparent text-2xl font-black text-white outline-none" /></label></div><input name="motivoRefugo" placeholder="Motivo da perda, se houver" className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950/30 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400" /><button type="submit" className="min-h-12 w-full rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200">Salvar produção</button></form>}{item.lancamentos.length > 0 && <p className="mt-3 text-xs text-slate-500">Último registro: {item.lancamentos[0].quantidadeBoa} boas · {item.lancamentos[0].quantidadeRefugo} perdas · {item.lancamentos[0].funcionario.nome}</p>}</section>;
        })}</div>
      </div>
    </main>
  );
}
