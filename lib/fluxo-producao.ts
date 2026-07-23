import type { Setor } from "@/app/generated/prisma/client";
import type { FlowFinal, FlowOP, FlowSector } from "@/components/production-flow-map";
import type { OPComDados } from "@/lib/pcp";
import { calcularProgressoOPs } from "@/lib/pcp";
import { calcularRastreamento } from "@/lib/rastreamento";
import { PROCESSO_LABEL, PROCESSOS } from "@/lib/processos";
import { ehSetor, ehSetorFinal } from "@/lib/setores";

export function montarFluxoProducao(ops: OPComDados[], setores: Setor[]) {
  const rastreamento = calcularRastreamento(ops);
  const progresso = calcularProgressoOPs(ops);

  const flowOps: FlowOP[] = rastreamento.map((item) => ({
    id: item.op.id,
    sequencia: item.op.numeroSequencia,
    codigo: item.op.modelo.codigo,
    nome: item.op.modelo.nome,
    quantidade: item.op.quantidade,
    kits: item.kitsCompletos,
    demandas: item.setores.map((setor) => ({
      setorId: setor.setorId,
      setorNome: setor.setorNome,
      necessaria: setor.necessaria,
      pronta: setor.pronta,
      pecas: setor.pecas.map((peca) => ({
        codigo: peca.codigo,
        nome: peca.nome,
        necessaria: peca.necessaria,
        pronta: peca.pronta,
      })),
    })),
  }));

  const flowSetores: FlowSector[] = setores
    .filter((setor) => !ehSetorFinal(setor.nome))
    .map((setor) => {
      const pecas = rastreamento.flatMap((item) =>
        item.pecas
          .filter((peca) => peca.setorId === setor.id)
          .map((peca) => ({ ...peca, opId: item.op.id })),
      );
      return {
        id: setor.id,
        nome: setor.nome,
        ops: new Set(pecas.map((peca) => peca.opId)).size,
        necessaria: pecas.reduce((soma, peca) => soma + peca.necessaria, 0),
        pronta: pecas.reduce((soma, peca) => soma + peca.pronta, 0),
        processos: PROCESSOS.map((processo) => {
          const etapas = pecas.flatMap((peca) =>
            peca.processos.filter((etapa) => etapa.codigo === processo),
          );
          return {
            nome: PROCESSO_LABEL[processo],
            quantidade: etapas.reduce((soma, etapa) => soma + etapa.quantidade, 0),
            necessaria: etapas.reduce((soma, etapa) => soma + etapa.necessaria, 0),
          };
        }).filter((processo) => processo.necessaria > 0),
      };
    });

  const flowFinal: FlowFinal[] = ["Abastecimento", "Solda", "Pintura", "Montagem"].map((nome) => {
    if (nome === "Abastecimento") {
      const quantidade = rastreamento.reduce(
        (soma, item) => soma + Math.min(item.kitsCompletos, item.op.quantidade),
        0,
      );
      const necessaria = rastreamento.reduce((soma, item) => soma + item.op.quantidade, 0);
      return {
        nome,
        ops: rastreamento.filter((item) => item.kitsCompletos < item.op.quantidade).length,
        quantidade,
        necessaria,
      };
    }
    const etapas = progresso.flatMap((item) =>
      item.setores.filter((etapa) => ehSetor(etapa.setorNome, nome)),
    );
    return {
      nome,
      ops: etapas.filter((etapa) => !etapa.completo).length,
      quantidade: etapas.reduce((soma, etapa) => soma + etapa.quantidadeBoa, 0),
      necessaria: etapas.reduce((soma, etapa) => soma + etapa.quantidadeBoa + etapa.falta, 0),
    };
  });

  return { flowOps, flowSetores, flowFinal };
}
