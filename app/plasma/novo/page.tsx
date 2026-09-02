import Link from "next/link";
import { NestForm } from "@/components/nest-form";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

function ehPlasma(nome: string) {
  return ehSetor(nome, "Plasma Chapa") || ehSetor(nome, "Plasma Tubo");
}

export default async function NovoNestPage() {
  const usuario = await buscarOperadorLogado();
  const todosSetores = await prisma.setor.findMany({ select: { id: true, nome: true }, orderBy: { ordemPadrao: "asc" } });
  const setores = todosSetores.filter((setor) => ehPlasma(setor.nome));
  const setorIds = setores.map((setor) => setor.id);
  const [maquinas, ops] = await Promise.all([
    prisma.maquina.findMany({
      where: { setorId: { in: setorIds }, ativo: true },
      select: { id: true, codigo: true, nome: true, setorId: true },
      orderBy: [{ setorId: "asc" }, { codigo: "asc" }],
    }),
    prisma.oP.findMany({
      where: { status: "ABERTA" },
      select: {
        id: true,
        lote: true,
        quantidade: true,
        numeroSequencia: true,
        modelo: {
          select: {
            codigo: true,
            nome: true,
            pecas: {
              select: {
                quantidadeNecessaria: true,
                peca: {
                  select: {
                    id: true,
                    codigo: true,
                    nome: true,
                    medida: true,
                    setorId: true,
                    roteiro: { select: { setorId: true, processo: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ numeroSequencia: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const opcoesOP = ops.map((op) => {
    const referencias = new Set<string>();
    const itens = op.modelo.pecas.flatMap((componente) => {
      const setoresDaPeca = new Set<number>();
      if (setorIds.includes(componente.peca.setorId)) setoresDaPeca.add(componente.peca.setorId);
      componente.peca.roteiro.forEach((etapa) => {
        if (setorIds.includes(etapa.setorId) && etapa.processo.toUpperCase().includes("CORTE")) setoresDaPeca.add(etapa.setorId);
      });
      return [...setoresDaPeca].map((setorId) => ({
        referencia: `${op.id}:${componente.peca.id}`,
        setorId,
        opId: op.id,
        codigoPeca: componente.peca.codigo,
        quantidadePlanejada: op.quantidade * componente.quantidadeNecessaria,
        descricao: `${componente.peca.codigo} - ${componente.peca.nome}${componente.peca.medida ? ` (${componente.peca.medida})` : ""}`,
      }));
    }).filter((item) => {
      if (referencias.has(`${item.setorId}:${item.referencia}`)) return false;
      referencias.add(`${item.setorId}:${item.referencia}`);
      return true;
    });
    return {
      id: op.id,
      label: `OP ${op.lote ?? `#${op.id}`} · ${op.modelo.codigo}${op.modelo.nome ? ` · ${op.modelo.nome}` : ""}`,
      itens,
    };
  }).filter((op) => op.itens.length > 0);

  const podeProgramar = Boolean(
    usuario && (usuario.administrador || ["LIDER", "PCP"].includes(usuario.papel) || (usuario.papel === "OPERADOR" && setorIds.includes(usuario.setorId))),
  );
  if (!podeProgramar) return null;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/plasma" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para o painel Plasma</Link>
          <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Nova programação</p>
          <h2 className="mt-1 text-2xl font-bold uppercase text-white">PROGRAMAR NOVO NEST</h2>
          <p className="mt-1 text-sm text-slate-400">Escolha a OP, confirme as peças e registre os dados da chapa e da máquina.</p>
        </div>
        <Link href="/plasma" className="rounded border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Ver NESTs cadastrados</Link>
      </div>

      <section className="rounded-xl border border-cyan-400/20 bg-[#202a36] p-4 shadow-lg shadow-black/10 sm:p-5">
        <NestForm setores={setores} maquinas={maquinas} opcoesOP={opcoesOP} />
      </section>
    </div>
  );
}
