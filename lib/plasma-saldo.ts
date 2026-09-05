import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { saldoProgramacao } from "@/lib/plasma-regras";

export async function buscarDemandaPlasma(opId?: number) {
  const setores = (await prisma.setor.findMany({ select: { id: true, nome: true } }))
    .filter(s => ehSetor(s.nome, "Plasma Chapa") || ehSetor(s.nome, "Plasma Tubo"));
  const ids = setores.map(s => s.id);
  const ops = await prisma.oP.findMany({
    where: { status: "ABERTA", ...(opId ? { id: opId } : {}) }, orderBy: [{ numeroSequencia: "asc" }, { createdAt: "asc" }],
    include: {
      modelo: { include: { pecas: { include: { peca: { include: { roteiro: true } } } } } },
      apontamentos: { where: { setorId: { in: ids }, OR: [{ processo: "CORTE" }, { processo: null }] },
        select: { pecaId: true, setorId: true, quantidadeBoa: true } },
      itensNest: { include: { nest: { select: { id: true, codigo: true, status: true, setorId: true } }, lancamentos: true } },
    },
  });
  return ops.flatMap(op => op.modelo.pecas.flatMap(componente => {
    const peca = componente.peca;
    const setoresPeca = new Set(peca.roteiro.filter(r => ids.includes(r.setorId) && r.processo.includes("CORTE")).map(r => r.setorId));
    if (ids.includes(peca.setorId)) setoresPeca.add(peca.setorId);
    return [...setoresPeca].map(setorId => {
      const itens = op.itensNest.filter(i => i.pecaId === peca.id && i.nest.setorId === setorId);
      const saldo = saldoProgramacao(op.quantidade * componente.quantidadeNecessaria,
        op.apontamentos.filter(a => a.pecaId === peca.id && a.setorId === setorId).reduce((s, a) => s + a.quantidadeBoa, 0),
        itens.map(i => ({ ...i, status: i.nest.status })));
      return { ...saldo, setorId, opId: op.id, pecaId: peca.id, referencia: `${op.id}:${peca.id}`,
        opLabel: `OP ${op.lote ?? `#${op.id}`} · ${op.modelo.codigo}`,
        codigo: peca.codigo, nome: peca.nome, medida: peca.medida, imagemUrl: peca.imagemUrl,
        origens: itens.filter(i => i.lancamentos.some(l => (l.quantidadeConferidaRefugo ?? l.quantidadeRefugo) > 0)).map(i => i.nest),
      };
    });
  }));
}

/** Porta de saída do plasma: a OP inteira precisa ter todos os cortes conferidos. */
export async function exigirCorteCompleto(opId: number) {
  const pendentes = (await buscarDemandaPlasma(opId)).filter(d => d.oficial < d.necessaria);
  if (pendentes.length) {
    throw new Error(`OP bloqueada no Plasma: ${pendentes.length} componente(s) ainda sem corte total conferido. ${pendentes[0].codigo}: ${pendentes[0].oficial}/${pendentes[0].necessaria}.`);
  }
}
