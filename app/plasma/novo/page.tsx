import Link from "next/link";
import { redirect } from "next/navigation";
import { NestForm } from "@/components/nest-form";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { buscarDemandaPlasma } from "@/lib/plasma-saldo";

function ehPlasma(nome: string) {
  return ehSetor(nome, "Plasma Chapa") || ehSetor(nome, "Plasma Tubo");
}

export default async function NovoNestPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const somenteReposicao = sp.reposicao === "1";
  const usuario = await buscarOperadorLogado();
  const todosSetores = await prisma.setor.findMany({ select: { id: true, nome: true }, orderBy: { ordemPadrao: "asc" } });
  const setores = todosSetores.filter((setor) => ehPlasma(setor.nome));
  const setorIds = setores.map((setor) => setor.id);
  const [maquinas, demanda] = await Promise.all([
    prisma.maquina.findMany({
      where: { setorId: { in: setorIds }, ativo: true },
      select: { id: true, codigo: true, nome: true, setorId: true },
      orderBy: [{ setorId: "asc" }, { codigo: "asc" }],
    }),
    buscarDemandaPlasma(),
  ]);

  type ItemFormulario = {
    referencia: string; setorId: number; opId: number; codigoPeca: string; imagemUrl: string | null;
    quantidadePlanejada: number; quantidadeNecessaria: number; perdas: number; reposicao: boolean; descricao: string;
  };
  const porOp = new Map<number, { id: number; label: string; itens: ItemFormulario[] }>();
  for (const item of demanda.filter(item => item.disponivel > 0 && (!somenteReposicao || item.reposicao > 0))) {
    const grupo = porOp.get(item.opId) ?? { id: item.opId, label: item.opLabel, itens: [] };
    grupo.itens.push({
      referencia: item.referencia, setorId: item.setorId, opId: item.opId, codigoPeca: item.codigo,
      imagemUrl: item.imagemUrl, quantidadePlanejada: somenteReposicao ? item.reposicao : item.disponivel,
      quantidadeNecessaria: item.necessaria, perdas: item.perdas, reposicao: item.reposicao > 0,
      descricao: `${item.codigo} - ${item.nome}${item.medida ? ` (${item.medida})` : ""}`,
    });
    porOp.set(item.opId, grupo);
  }
  const opcoesOP = [...porOp.values()];

  const podeProgramar = Boolean(
    usuario && (usuario.administrador || usuario.papel === "PCP" || (["LIDER", "OPERADOR"].includes(usuario.papel) && setorIds.includes(usuario.setorId))),
  );
  if (!podeProgramar) redirect("/plasma");

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/plasma" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para o painel Plasma</Link>
          <p className="mt-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{somenteReposicao ? "Reposição consolidada" : "Nova programação"}</p>
          <h2 className="mt-1 text-2xl font-bold uppercase text-white">{somenteReposicao ? "PROGRAMAR PEÇAS PERDIDAS" : "PROGRAMAR NOVO NEST"}</h2>
          <p className="mt-1 text-sm text-slate-400">{somenteReposicao ? "Agrupe perdas de diferentes NESTs em uma única programação." : "Vincule OPs, peças, chapa e uma das máquinas cadastradas."}</p>
        </div>
        <Link href="/plasma" className="rounded border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Ver NESTs cadastrados</Link>
      </div>

      <section className="rounded-xl border border-cyan-400/20 bg-[#202a36] p-4 shadow-lg shadow-black/10 sm:p-5">
        <NestForm setores={setores} maquinas={maquinas} opcoesOP={opcoesOP} modoReposicao={somenteReposicao} />
      </section>
    </div>
  );
}
