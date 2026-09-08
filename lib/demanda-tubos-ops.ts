import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import type { ItemDemandaTubo } from "@/lib/otimizador-corte-tubo";

export type OpDisponivelTubo = {
  id: number;
  numeroSequencia: number;
  lote: string;
  modeloCodigo: string;
  modeloNome: string | null;
  quantidadeTotal: number;
  totalPecasTuboPendentes: number;
};

/**
 * Extrai medidas a partir do texto livre `medida` caso os campos numéricos estejam vazios.
 * Exemplo de texto: "40 × 40 × 3 mm · comp. 1010 mm"
 */
function extrairMedidasTexto(medidaTexto: string | null | undefined): {
  medidaA: number | null;
  medidaB: number | null;
  espessuraMm: number | null;
  comprimentoMm: number | null;
} {
  if (!medidaTexto) {
    return { medidaA: null, medidaB: null, espessuraMm: null, comprimentoMm: null };
  }

  let comprimentoMm: number | null = null;
  const matchComp = medidaTexto.match(/comp(?:rimento)?\.?\s*(\d+(?:[.,]\d+)?)\s*mm/i);
  if (matchComp) {
    comprimentoMm = parseFloat(matchComp[1].replace(",", "."));
  }

  let medidaA: number | null = null;
  let medidaB: number | null = null;
  let espessuraMm: number | null = null;

  // Tentar casar: 40 x 40 x 3 ou 50 x 30 x 2.5
  const matchDim3 = medidaTexto.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*mm/i);
  if (matchDim3) {
    medidaA = parseFloat(matchDim3[1].replace(",", "."));
    medidaB = parseFloat(matchDim3[2].replace(",", "."));
    espessuraMm = parseFloat(matchDim3[3].replace(",", "."));
  } else {
    // Tentar casar tubo redondo: Ø 50 x 3 mm
    const matchRedondo = medidaTexto.match(/(?:Ø|diam|d|diâmetro)?\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*mm/i);
    if (matchRedondo) {
      medidaA = parseFloat(matchRedondo[1].replace(",", "."));
      espessuraMm = parseFloat(matchRedondo[2].replace(",", "."));
    }
  }

  return { medidaA, medidaB, espessuraMm, comprimentoMm };
}

export function formatarNomePerfil(perfilA: number, perfilB: number | null, espessuraMm: number): string {
  if (perfilB === null || perfilB === 0 || perfilB === perfilA) {
    if (perfilB === perfilA) {
      return `Tubo Quadrado ${perfilA} × ${perfilA} × ${espessuraMm} mm`;
    }
    return `Tubo Redondo Ø ${perfilA} × ${espessuraMm} mm`;
  }
  return `Tubo Retangular ${perfilA} × ${perfilB} × ${espessuraMm} mm`;
}

/**
 * Busca todas as OPs abertas e calcula a demanda pendente de peças do setor Tubo.
 */
export async function buscarDemandasTubo(opsIdsFiltro?: number[]): Promise<{
  demandas: ItemDemandaTubo[];
  opsDisponiveis: OpDisponivelTubo[];
  setorTuboId: number | null;
}> {
  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  const setorTubo = setores.find((s) => ehSetor(s.nome, "Tubo"));
  const setorTuboId = setorTubo?.id ?? null;

  const opsAbertas = await prisma.oP.findMany({
    where: {
      status: "ABERTA",
      ...(opsIdsFiltro && opsIdsFiltro.length > 0 ? { id: { in: opsIdsFiltro } } : {}),
    },
    orderBy: [{ numeroSequencia: "asc" }, { id: "asc" }],
    include: {
      modelo: {
        include: {
          pecas: {
            include: {
              peca: {
                include: {
                  setor: true,
                  roteiro: { include: { setor: true } },
                },
              },
            },
          },
        },
      },
      apontamentos: true,
    },
  });

  const demandas: ItemDemandaTubo[] = [];
  const resumoOpsMap = new Map<number, OpDisponivelTubo>();

  for (const op of opsAbertas) {
    let totalPecasOp = 0;

    for (const itemBOM of op.modelo.pecas) {
      const peca = itemBOM.peca;

      // Verificar se pertence ao setor Tubo ou material TUBO
      const ehDoSetorTubo =
        (setorTuboId !== null && peca.setorId === setorTuboId) ||
        ehSetor(peca.setor.nome, "Tubo") ||
        peca.tipoMaterial === "TUBO" ||
        peca.roteiro.some((r) => setorTuboId !== null && r.setorId === setorTuboId);

      if (!ehDoSetorTubo) continue;

      // Calcular quantidade total necessária da peça na OP
      const quantidadeNecessariaTotal = op.quantidade * itemBOM.quantidadeNecessaria;

      // Descontar apontamentos já concluídos (peças boas cortadas no Tubo)
      const apontadoTubo = op.apontamentos
        .filter((a) => {
          const aSetor = (setorTuboId !== null && a.setorId === setorTuboId) || a.pecaId === peca.id;
          return aSetor && a.pecaId === peca.id;
        })
        .reduce((sum, a) => sum + a.quantidadeBoa, 0);

      const pendente = Math.max(0, quantidadeNecessariaTotal - apontadoTubo);
      if (pendente <= 0) continue;

      // Resolver medidas estruturadas com fallback para o texto de medida
      const extraido = extrairMedidasTexto(peca.medida);
      const comprimento = peca.comprimentoMm ?? extraido.comprimentoMm;
      const perfilA = peca.medidaA ?? extraido.medidaA ?? 40;
      const perfilB = peca.medidaB ?? extraido.medidaB;
      const espessura = peca.espessuraMm ?? extraido.espessuraMm ?? 3;

      if (!comprimento || comprimento <= 0) {
        // Se ainda assim não houver comprimento, não tem como calcular corte linear
        continue;
      }

      totalPecasOp += pendente;
      const nomePerfil = formatarNomePerfil(perfilA, perfilB, espessura);

      demandas.push({
        opId: op.id,
        opNumero: op.numeroSequencia,
        lote: op.lote ?? `LOTE-${op.numeroSequencia}`,
        modeloCodigo: op.modelo.codigo,
        pecaId: peca.id,
        pecaCodigo: peca.codigo,
        pecaNome: peca.nome,
        comprimentoMm: comprimento,
        quantidade: pendente,
        perfil: nomePerfil,
        perfilA,
        perfilB,
        espessuraMm: espessura,
      });
    }

    resumoOpsMap.set(op.id, {
      id: op.id,
      numeroSequencia: op.numeroSequencia,
      lote: op.lote ?? `LOTE-${op.numeroSequencia}`,
      modeloCodigo: op.modelo.codigo,
      modeloNome: op.modelo.nome,
      quantidadeTotal: op.quantidade,
      totalPecasTuboPendentes: totalPecasOp,
    });
  }

  // Buscar todas as OPs abertas (mesmo que não filtradas) para o seletor de filtros
  const todasOpsAbertas = await prisma.oP.findMany({
    where: { status: "ABERTA" },
    orderBy: { numeroSequencia: "asc" },
    select: {
      id: true,
      numeroSequencia: true,
      lote: true,
      quantidade: true,
      modelo: { select: { codigo: true, nome: true } },
    },
  });

  const opsDisponiveis: OpDisponivelTubo[] = todasOpsAbertas.map((o) => {
    const pendente = resumoOpsMap.get(o.id)?.totalPecasTuboPendentes ?? 0;
    return {
      id: o.id,
      numeroSequencia: o.numeroSequencia,
      lote: o.lote ?? `LOTE-${o.numeroSequencia}`,
      modeloCodigo: o.modelo.codigo,
      modeloNome: o.modelo.nome,
      quantidadeTotal: o.quantidade,
      totalPecasTuboPendentes: pendente,
    };
  });

  return {
    demandas,
    opsDisponiveis,
    setorTuboId,
  };
}
