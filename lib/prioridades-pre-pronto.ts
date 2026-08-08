import { PROCESSO_LABEL, type Processo } from "@/lib/processos";
import type { OPRastreada } from "@/lib/rastreamento";
import { ehSetorFinal } from "@/lib/setores";

export type ClassificacaoPrioridade =
  | "FECHAR_PRE_PRONTO"
  | "QUASE_CONCLUIDA"
  | "PLANEJAR";

export type PrioridadePrePronto = {
  chave: string;
  prioridade: number;
  classificacao: ClassificacaoPrioridade;
  opId: number;
  numeroSequencia: number;
  lote: string | null;
  modeloCodigo: string;
  setorId: number;
  setorNome: string;
  pecaId: number;
  pecaCodigo: string;
  pecaNome: string;
  processo: Processo;
  processoLabel: string;
  necessaria: number;
  produzida: number;
  restante: number;
  percentual: number;
  pecasCompletas: number;
  pecasTotal: number;
  pecasPendentes: number;
  preProntoPercentual: number;
  motivo: string;
};

/**
 * Monta uma fila de fabricação para fechar os pré-prontos com o menor número
 * de retomadas possível. O critério principal é fechar uma OP que já tem
 * todas as outras peças prontas; em empate, prevalece a sequência da OP.
 */
export function calcularPrioridadesPrePronto(
  itens: OPRastreada[],
  setorId: number,
): PrioridadePrePronto[] {
  const prioridades: PrioridadePrePronto[] = [];

  for (const item of itens) {
    const pecasDoPrePronto = item.pecas.filter((peca) => !ehSetorFinal(peca.setorNome));
    const porPeca = new Map<number, { completa: boolean }>();

    for (const peca of pecasDoPrePronto) {
      const atual = porPeca.get(peca.id);
      porPeca.set(peca.id, {
        completa: (atual?.completa ?? true) && peca.falta <= 0,
      });
    }

    const pecasTotal = porPeca.size;
    const pecasCompletas = [...porPeca.values()].filter((peca) => peca.completa).length;
    const pecasPendentes = Math.max(pecasTotal - pecasCompletas, 0);
    const preProntoPercentual = pecasTotal > 0
      ? Math.round((pecasCompletas / pecasTotal) * 100)
      : 0;

    for (const peca of item.pecas.filter((peca) => peca.setorId === setorId && peca.falta > 0)) {
      const processoAtual = peca.processos.find((processo) => processo.estado !== "concluido") ?? peca.processos.at(-1);
      if (!processoAtual) continue;

      const percentual = peca.necessaria > 0
        ? Math.min(100, Math.round((peca.pronta / peca.necessaria) * 100))
        : 0;
      const limiteQuaseConcluida = Math.max(1, Math.ceil(peca.necessaria * 0.1));
      const fechaPrePronto = pecasPendentes === 1;
      const quaseConcluida = peca.falta <= limiteQuaseConcluida || percentual >= 90;
      const classificacao: ClassificacaoPrioridade = fechaPrePronto
        ? "FECHAR_PRE_PRONTO"
        : quaseConcluida
          ? "QUASE_CONCLUIDA"
          : "PLANEJAR";
      const prioridade = classificacao === "FECHAR_PRE_PRONTO"
        ? 1
        : classificacao === "QUASE_CONCLUIDA"
          ? 2
          : 3;

      prioridades.push({
        chave: `${item.op.id}-${setorId}-${peca.id}`,
        prioridade,
        classificacao,
        opId: item.op.id,
        numeroSequencia: item.op.numeroSequencia,
        lote: item.op.lote,
        modeloCodigo: item.op.modelo.codigo,
        setorId,
        setorNome: peca.setorNome,
        pecaId: peca.id,
        pecaCodigo: peca.codigo,
        pecaNome: peca.nome,
        processo: processoAtual.codigo,
        processoLabel: processoAtual.nome || PROCESSO_LABEL[processoAtual.codigo],
        necessaria: peca.necessaria,
        produzida: peca.pronta,
        restante: peca.falta,
        percentual,
        pecasCompletas,
        pecasTotal,
        pecasPendentes,
        preProntoPercentual,
        motivo: fechaPrePronto
          ? "Última peça pendente para fechar o pré-pronto desta OP."
          : quaseConcluida
            ? `Restam ${peca.falta.toLocaleString("pt-BR")} unidade(s) neste setor.`
            : `${pecasCompletas} de ${pecasTotal} peças do pré-pronto já estão completas.`,
      });
    }
  }

  return prioridades.sort((a, b) =>
    a.prioridade - b.prioridade ||
    a.numeroSequencia - b.numeroSequencia ||
    b.preProntoPercentual - a.preProntoPercentual ||
    a.restante - b.restante ||
    a.pecaCodigo.localeCompare(b.pecaCodigo, "pt-BR"),
  );
}
