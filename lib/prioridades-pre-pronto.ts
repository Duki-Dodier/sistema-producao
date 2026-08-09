import { PROCESSO_LABEL, type Processo } from "@/lib/processos";
import type { OPRastreada } from "@/lib/rastreamento";
import { ehSetorFinal } from "@/lib/setores";

export type PrioridadePrePronto = {
  chave: string;
  prioridade: number;
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
  outrosNecessario: number;
  outrosPronto: number;
  prontidaoOutrosPercentual: number;
  motivo: string;
};

/**
 * Monta a fila de um setor pela prontidão do restante da OP.
 *
 * O setor selecionado fica fora do cálculo: uma OP com 71% concluído nos
 * outros setores deve aparecer antes de uma OP com 70% para o mesmo setor.
 * O peso é a quantidade necessária de cada peça, evitando que uma peça de
 * quantidade pequena tenha o mesmo peso de um lote maior.
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

    const outrosSetores = item.pecas.filter(
      (peca) => peca.setorId !== setorId && !ehSetorFinal(peca.setorNome),
    );
    const outrosNecessario = outrosSetores.reduce(
      (total, peca) => total + Math.max(peca.necessaria, 0),
      0,
    );
    const outrosPronto = outrosSetores.reduce(
      (total, peca) => total + Math.min(Math.max(peca.pronta, 0), Math.max(peca.necessaria, 0)),
      0,
    );
    const prontidaoOutrosPercentual = outrosNecessario > 0
      ? Math.min(100, Math.round((outrosPronto / outrosNecessario) * 100))
      : 100;
    const motivo = outrosNecessario > 0
      ? `Outros setores: ${prontidaoOutrosPercentual}% concluídos.`
      : "Não há outras peças pendentes em setores anteriores.";

    for (const peca of item.pecas.filter((peca) => peca.setorId === setorId && peca.falta > 0)) {
      const processoAtual = peca.processos.find((processo) => processo.estado !== "concluido") ?? peca.processos.at(-1);
      if (!processoAtual) continue;

      const percentual = peca.necessaria > 0
        ? Math.min(100, Math.round((peca.pronta / peca.necessaria) * 100))
        : 0;

      prioridades.push({
        chave: `${item.op.id}-${setorId}-${peca.id}`,
        prioridade: 0,
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
        outrosNecessario,
        outrosPronto,
        prontidaoOutrosPercentual,
        motivo,
      });
    }
  }

  return prioridades
    .sort((a, b) =>
      b.prontidaoOutrosPercentual - a.prontidaoOutrosPercentual ||
      a.numeroSequencia - b.numeroSequencia ||
      b.preProntoPercentual - a.preProntoPercentual ||
      a.restante - b.restante ||
      a.pecaCodigo.localeCompare(b.pecaCodigo, "pt-BR"),
    )
    .map((item, indice) => ({ ...item, prioridade: indice + 1 }));
}
