import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import type { DemandaCorteTubo, SobraDisponivelTubo } from "@/lib/tubo-plano-corte";

export type PecaTuboIncompleta = {
  id: number;
  codigo: string;
  nome: string;
  campos: string[];
};

export async function buscarSetorTubo() {
  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  return setores.find((setor) => ehSetor(setor.nome, "Tubo")) ?? null;
}

export async function buscarDemandaPlanoTubo(setorId: number) {
  const ops = await prisma.oP.findMany({
    where: {
      status: "ABERTA",
      modelo: { pecas: { some: { peca: { setorId } } } },
    },
    orderBy: [{ numeroSequencia: "asc" }, { id: "asc" }],
    select: {
      id: true,
      numeroSequencia: true,
      lote: true,
      quantidade: true,
      modelo: {
        select: {
          codigo: true,
          pecas: {
            where: { peca: { setorId } },
            select: {
              quantidadeNecessaria: true,
              peca: {
                select: {
                  id: true, codigo: true, nome: true, tipoMaterial: true,
                  medidaA: true, medidaB: true, espessuraMm: true, comprimentoMm: true,
                },
              },
            },
          },
        },
      },
      apontamentos: {
        where: { setorId, processo: "CORTE" },
        select: { pecaId: true, quantidadeBoa: true },
      },
      itensPlanoCorteTubo: {
        where: { barra: { plano: { status: "EMITIDO" } } },
        select: { pecaId: true, quantidade: true },
      },
    },
  });

  const demandas: DemandaCorteTubo[] = [];
  const incompletas = new Map<number, PecaTuboIncompleta>();
  for (const op of ops) {
    for (const componente of op.modelo.pecas) {
      const peca = componente.peca;
      const planejado = op.quantidade * componente.quantidadeNecessaria;
      const produzido = op.apontamentos
        .filter((item) => item.pecaId === peca.id)
        .reduce((total, item) => total + item.quantidadeBoa, 0);
      const reservado = op.itensPlanoCorteTubo
        .filter((item) => item.pecaId === peca.id)
        .reduce((total, item) => total + item.quantidade, 0);
      const pendente = Math.max(planejado - produzido - reservado, 0);
      if (pendente === 0) continue;
      const campos: string[] = [];
      if (peca.medidaA === null || peca.medidaA <= 0) campos.push("largura/diâmetro");
      if (peca.medidaB === null || peca.medidaB <= 0) campos.push("altura");
      if (peca.espessuraMm === null || peca.espessuraMm <= 0) campos.push("espessura");
      if (peca.comprimentoMm === null || peca.comprimentoMm <= 0) campos.push("comprimento");
      if (campos.length > 0) {
        incompletas.set(peca.id, { id: peca.id, codigo: peca.codigo, nome: peca.nome, campos });
        continue;
      }
      demandas.push({
        opId: op.id,
        opNumero: op.numeroSequencia,
        lote: op.lote ?? "SEM LOTE",
        modelo: op.modelo.codigo,
        pecaId: peca.id,
        pecaCodigo: peca.codigo,
        pecaNome: peca.nome,
        quantidade: pendente,
        comprimentoMm: peca.comprimentoMm!,
        perfilA: peca.medidaA!,
        perfilB: peca.medidaB,
        espessuraMm: peca.espessuraMm!,
      });
    }
  }

  const sobras = await prisma.sobraTubo.findMany({
    where: { status: "DISPONIVEL" },
    orderBy: [{ comprimentoMm: "asc" }, { id: "asc" }],
    select: { id: true, codigo: true, comprimentoMm: true, perfilA: true, perfilB: true, espessuraMm: true },
  }) as SobraDisponivelTubo[];

  return { demandas, incompletas: [...incompletas.values()], sobras };
}

export async function gerarSnapshotPlanoTubo(
  demandas: DemandaCorteTubo[],
  sobras: SobraDisponivelTubo[],
  parametros: Record<string, number>,
) {
  const texto = JSON.stringify({
    demandas: demandas.map((item) => [item.opId, item.pecaId, item.quantidade, item.comprimentoMm, item.perfilA, item.perfilB, item.espessuraMm]),
    sobras: sobras.map((item) => [item.id, item.comprimentoMm, item.perfilA, item.perfilB, item.espessuraMm]),
    parametros,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const planoTuboInclude = {
  setor: { select: { id: true, nome: true } },
  maquina: { select: { id: true, codigo: true, nome: true } },
  criadoPor: { select: { id: true, nome: true } },
  concluidoPor: { select: { id: true, nome: true } },
  canceladoPor: { select: { id: true, nome: true } },
  barras: {
    orderBy: { ordem: "asc" as const },
    include: {
      itens: {
        orderBy: { ordem: "asc" as const },
        include: {
          op: { select: { id: true, numeroSequencia: true, lote: true, modelo: { select: { codigo: true } } } },
          peca: { select: { id: true, codigo: true, nome: true } },
        },
      },
    },
  },
} as const;
