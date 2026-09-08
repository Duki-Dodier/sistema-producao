import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import type { DemandaCorteTubo } from "@/lib/plano-corte-tubos";
import { PERFIS_TUBO_SUPORTADOS } from "@/lib/plano-corte-tubos";

export type PecaPendentePlanoTubo = {
  id: number;
  codigo: string;
  nome: string;
  perfilMm: number | null;
  espessuraMm: number | null;
  comprimentoMm: number | null;
  planejado: number;
  produzido: number;
  pendente: number;
  apta: boolean;
  problemas: string[];
};

export type OpDisponivelPlanoTubo = {
  id: number;
  numeroSequencia: number;
  lote: string;
  modeloCodigo: string;
  modeloNome: string | null;
  quantidade: number;
  totalPecasPendentes: number;
  apta: boolean;
  problemas: string[];
  pecas: PecaPendentePlanoTubo[];
};

function igual(a: number | null, b: number) {
  return a !== null && Math.abs(a - b) < 0.01;
}

function perfilQuadradoSuportado(medidaA: number | null, medidaB: number | null) {
  return PERFIS_TUBO_SUPORTADOS.find((perfil) => igual(medidaA, perfil) && igual(medidaB, perfil)) ?? null;
}

export async function buscarOpsDisponiveisPlanoCorteTubos(): Promise<{
  ops: OpDisponivelPlanoTubo[];
  demandasPorOp: Map<number, DemandaCorteTubo[]>;
  setorTuboId: number | null;
}> {
  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  const setorTubo = setores.find((setor) => ehSetor(setor.nome, "Tubo")) ?? null;
  if (!setorTubo) return { ops: [], demandasPorOp: new Map(), setorTuboId: null };

  const registros = await prisma.oP.findMany({
    where: { status: "ABERTA" },
    orderBy: [{ numeroSequencia: "asc" }, { id: "asc" }],
    select: {
      id: true,
      numeroSequencia: true,
      lote: true,
      quantidade: true,
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
                  setorId: true,
                  tipoMaterial: true,
                  medidaA: true,
                  medidaB: true,
                  espessuraMm: true,
                  comprimentoMm: true,
                  processos: true,
                  roteiro: { select: { setorId: true, processo: true } },
                },
              },
            },
          },
        },
      },
      apontamentos: {
        where: { setorId: setorTubo.id },
        select: { pecaId: true, processo: true, quantidadeBoa: true },
      },
    },
  });

  const demandasPorOp = new Map<number, DemandaCorteTubo[]>();
  const ops: OpDisponivelPlanoTubo[] = [];

  for (const op of registros) {
    const demandas: DemandaCorteTubo[] = [];
    const pecas: PecaPendentePlanoTubo[] = [];

    for (const componente of op.modelo.pecas) {
      const peca = componente.peca;
      const possuiCorteTuboNoRoteiro = peca.roteiro.some(
        (etapa) => etapa.setorId === setorTubo.id && etapa.processo.trim().toUpperCase() === "CORTE",
      );
      const processos = (peca.processos ?? "CORTE").split(",").map((processo) => processo.trim().toUpperCase());
      const pertenceAoCorteTubo = possuiCorteTuboNoRoteiro
        || (peca.setorId === setorTubo.id && processos.includes("CORTE"));
      if (!pertenceAoCorteTubo) continue;

      const planejado = op.quantidade * componente.quantidadeNecessaria;
      const produzido = op.apontamentos
        .filter((apontamento) => apontamento.pecaId === peca.id && (!apontamento.processo || apontamento.processo.toUpperCase() === "CORTE"))
        .reduce((total, apontamento) => total + apontamento.quantidadeBoa, 0);
      const pendente = Math.max(planejado - produzido, 0);
      if (pendente <= 0) continue;

      const problemas: string[] = [];
      const perfilMm = perfilQuadradoSuportado(peca.medidaA, peca.medidaB);
      if (perfilMm === null) problemas.push("perfil deve ser 40×40, 50×50 ou 60×60");
      if (peca.espessuraMm === null || peca.espessuraMm <= 0) problemas.push("espessura não informada");
      if (peca.comprimentoMm === null || peca.comprimentoMm <= 0) problemas.push("comprimento não informado");
      const apta = problemas.length === 0;

      pecas.push({
        id: peca.id,
        codigo: peca.codigo,
        nome: peca.nome,
        perfilMm,
        espessuraMm: peca.espessuraMm,
        comprimentoMm: peca.comprimentoMm,
        planejado,
        produzido,
        pendente,
        apta,
        problemas,
      });

      if (apta) {
        demandas.push({
          opId: op.id,
          opNumero: op.numeroSequencia,
          lote: op.lote ?? "SEM LOTE",
          modeloCodigo: op.modelo.codigo,
          pecaId: peca.id,
          pecaCodigo: peca.codigo,
          pecaNome: peca.nome,
          perfilMm: perfilMm!,
          espessuraMm: peca.espessuraMm!,
          comprimentoMm: peca.comprimentoMm!,
          quantidade: pendente,
        });
      }
    }

    const problemas = pecas.flatMap((peca) => peca.problemas.map((problema) => `${peca.codigo}: ${problema}`));
    if (pecas.length === 0) problemas.push("sem peças de tubo pendentes para corte");
    const apta = pecas.length > 0 && problemas.length === 0;
    if (apta) demandasPorOp.set(op.id, demandas);
    ops.push({
      id: op.id,
      numeroSequencia: op.numeroSequencia,
      lote: op.lote ?? "SEM LOTE",
      modeloCodigo: op.modelo.codigo,
      modeloNome: op.modelo.nome,
      quantidade: op.quantidade,
      totalPecasPendentes: pecas.reduce((total, peca) => total + peca.pendente, 0),
      apta,
      problemas,
      pecas,
    });
  }

  return { ops, demandasPorOp, setorTuboId: setorTubo.id };
}

export async function buscarDemandasSelecionadasPlanoCorteTubos(opsIds: number[]) {
  const unicos = [...new Set(opsIds)].filter((id) => Number.isInteger(id) && id > 0);
  const dados = await buscarOpsDisponiveisPlanoCorteTubos();
  const opsSelecionadas = dados.ops.filter((op) => unicos.includes(op.id));
  const inexistentes = unicos.filter((id) => !opsSelecionadas.some((op) => op.id === id));
  if (inexistentes.length) throw new Error("Uma ou mais OPs selecionadas não estão mais abertas.");
  const bloqueada = opsSelecionadas.find((op) => !op.apta);
  if (bloqueada) throw new Error(`A OP ${bloqueada.numeroSequencia} não pode ser calculada: ${bloqueada.problemas[0]}.`);
  const demandas = opsSelecionadas.flatMap((op) => dados.demandasPorOp.get(op.id) ?? []);
  return { demandas, opsSelecionadas, setorTuboId: dados.setorTuboId };
}

export const planoCorteTuboInclude = {
  criadoPor: { select: { id: true, nome: true } },
  padroes: {
    orderBy: { ordem: "asc" as const },
    include: { itens: { orderBy: { ordem: "asc" as const } } },
  },
} as const;
