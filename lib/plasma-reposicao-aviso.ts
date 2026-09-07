import { prisma } from "@/lib/prisma";

const EVENTO_SOLICITACAO = "REPOSICAO_SOLICITADA";
const EVENTO_VISUALIZACAO = "REPOSICAO_VISUALIZADA";

function eventoVisualizadoAte(descricao: string | null) {
  const encontrado = descricao?.match(/evento\s+(\d+)/i);
  return encontrado ? Number(encontrado[1]) : 0;
}

export async function buscarAvisoReposicaoPlasma(setorId: number) {
  const [ultimaSolicitacao, ultimaVisualizacao] = await Promise.all([
    prisma.nestEvento.findFirst({
      where: { tipo: EVENTO_SOLICITACAO, nest: { setorId } },
      orderBy: { id: "desc" },
      select: { id: true, nestId: true, dataHora: true },
    }),
    prisma.nestEvento.findFirst({
      where: { tipo: EVENTO_VISUALIZACAO, nest: { setorId } },
      orderBy: { id: "desc" },
      select: { descricao: true },
    }),
  ]);

  const visualizadoAte = eventoVisualizadoAte(ultimaVisualizacao?.descricao ?? null);
  return {
    ultimaSolicitacao,
    visualizadoAte,
    temNovidade: Boolean(ultimaSolicitacao && ultimaSolicitacao.id > visualizadoAte),
  };
}

export function eventoReposicaoSolicitada() {
  return EVENTO_SOLICITACAO;
}

export function eventoReposicaoVisualizada() {
  return EVENTO_VISUALIZACAO;
}

export function extrairEventoVisualizado(descricao: string | null) {
  return eventoVisualizadoAte(descricao);
}
