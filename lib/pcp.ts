import { Prisma } from "@/app/generated/prisma/client";
import { ehSetor } from "@/lib/setores";
import { processosDaPeca } from "@/lib/processos";

export const opComProgressoArgs = {
  include: {
    modelo: {
      include: {
        roteiro: { include: { setor: true }, orderBy: { ordem: "asc" } },
        pecas: {
          include: {
            peca: {
              include: {
                roteiro: { include: { setor: true }, orderBy: { ordem: "asc" } },
              },
            },
          },
        },
      },
    },
    apontamentos: true,
  },
} satisfies Prisma.OPDefaultArgs;
export type OPComDados = Prisma.OPGetPayload<typeof opComProgressoArgs>;

export type PecaProgresso = {
  pecaId: number;
  codigo: string;
  nome: string;
  medida: string | null;
  necessaria: number; // op.quantidade × quantidadeNecessaria por engate
  produzida: number;
  falta: number;
  completo: boolean;
};

export type SetorProgresso = {
  setorId: number;
  setorNome: string;
  ordem: number; // ordem dentro do roteiro deste modelo
  ordemPadrao: number; // ordem global do setor, p/ alinhar colunas entre modelos diferentes
  quantidadeBoa: number;
  falta: number;
  completo: boolean;
  concluidoEm: Date | null; // data do apontamento mais recente do setor, se completo
  pecas: PecaProgresso[]; // preenchido só quando o modelo tem BOM cadastrada p/ este setor
};

export type OPProgresso = {
  op: OPComDados;
  setores: SetorProgresso[];
  setoresPreSolda: SetorProgresso[]; // etapas antes da Solda no roteiro desta OP
  doneCount: number;
  totalCount: number;
  percentual: number;
  setorAtual: SetorProgresso | null; // primeiro setor ainda incompleto
  completo: boolean;
  prontoParaSolda: boolean; // todas as etapas pré-Solda concluídas
  foraDeSequencia: boolean;
  ultrapassadaPorSeq: number | null;
};

/**
 * Calcula, por OP, quanto já foi produzido em cada setor do roteiro e o que
 * falta — Falta(OP,Setor) = quantidade − Σ apontamentos.quantidadeBoa (ou,
 * quando o modelo tem peças/BOM cadastradas para o setor, o cálculo é feito
 * peça a peça: necessária = OP.quantidade × quantidadeNecessaria).
 * Também sinaliza quando uma OP de sequência menor está sendo ultrapassada
 * por uma de sequência maior (regra crítica de PCP do documento).
 */
export function calcularProgressoOPs(ops: OPComDados[]): OPProgresso[] {
  const base = ops.map((op) => {
    const setores: SetorProgresso[] = op.modelo.roteiro.map((r) => {
      const apontamentosDoSetor = op.apontamentos.filter(
        (a) => a.setorId === r.setorId,
      );
      const apontamentosDeProducao =
        ehSetor(r.setor.nome, "Solda")
          ? apontamentosDoSetor.filter((a) => a.soldador === null)
          : apontamentosDoSetor;
      const pecasDoSetor = op.modelo.pecas.filter((mp) =>
        mp.peca.roteiro.length > 0
          ? mp.peca.roteiro.some(
              (etapa) => etapa.setorId === r.setorId && etapa.processo !== "AGRUPAR",
            )
          : mp.peca.setorId === r.setorId,
      );

      let pecas: PecaProgresso[] = [];
      let produzido: number;
      let falta: number;
      let completo: boolean;

      if (pecasDoSetor.length > 0) {
        pecas = pecasDoSetor.map((mp) => {
          const necessaria = op.quantidade * mp.quantidadeNecessaria;
          const etapasNesteSetor = mp.peca.roteiro.filter(
            (etapa) => etapa.setorId === r.setorId && etapa.processo !== "AGRUPAR",
          );
          const etapaFinal = etapasNesteSetor.at(-1);
          const processoFinal = etapaFinal
            ? etapaFinal.processo
            : processosDaPeca({
                ...mp.peca,
                setor: { nome: r.setor.nome },
              }).at(-1);
          const produzidaEspecifica = apontamentosDoSetor
            .filter(
              (a) =>
                a.pecaId === mp.pecaId &&
                (a.processo === null ||
                  (etapaFinal
                    ? a.roteiroEtapaId === etapaFinal.id ||
                      (a.roteiroEtapaId === null && a.processo === processoFinal)
                    : a.processo === processoFinal)),
            )
            .reduce((sum, a) => sum + a.quantidadeBoa, 0);
          
          const produzidaGenerica = apontamentosDoSetor
            .filter((a) => a.pecaId === null)
            .reduce((sum, a) => sum + a.quantidadeBoa, 0);
            
          const produzida = produzidaEspecifica + produzidaGenerica;
          const faltaPeca = Math.max(necessaria - produzida, 0);
          return {
            pecaId: mp.pecaId,
            codigo: mp.peca.codigo,
            nome: mp.peca.nome,
            medida: mp.peca.medida,
            imagemUrl: mp.peca.imagemUrl,
            necessaria,
            produzida,
            falta: faltaPeca,
            completo: faltaPeca <= 0,
          };
        });
        produzido = pecas.reduce((sum, p) => sum + p.produzida, 0);
        falta = pecas.reduce((sum, p) => sum + p.falta, 0);
        completo = pecas.every((p) => p.completo);
      } else {
        produzido = apontamentosDeProducao.reduce((sum, a) => sum + a.quantidadeBoa, 0);
        falta = Math.max(op.quantidade - produzido, 0);
        completo = falta <= 0;
      }

      const concluidoEm =
        completo && apontamentosDeProducao.length > 0
          ? apontamentosDeProducao.reduce(
              (max, a) => (a.dataHora > max ? a.dataHora : max),
              apontamentosDeProducao[0].dataHora,
            )
          : null;

      return {
        setorId: r.setorId,
        setorNome: r.setor.nome,
        ordem: r.ordem,
        ordemPadrao: r.setor.ordemPadrao,
        quantidadeBoa: produzido,
        falta,
        completo,
        concluidoEm,
        pecas,
      };
    });

    const totalCount = setores.length;
    const doneCount = setores.filter((s) => s.completo).length;
    const setorAtual = setores.find((s) => !s.completo) ?? null;

    const soldaOrdem = setores.find((s) => ehSetor(s.setorNome, "Solda"))?.ordem;
    const setoresPreSolda =
      soldaOrdem !== undefined
        ? setores.filter((s) => s.ordem < soldaOrdem && !ehSetor(s.setorNome, "Abastecimento"))
        : setores.filter((s) => !ehSetor(s.setorNome, "Abastecimento"));
    const prontoParaSolda =
      setoresPreSolda.length > 0 && setoresPreSolda.every((s) => s.completo);

    return {
      op,
      setores,
      setoresPreSolda,
      doneCount,
      totalCount,
      percentual: totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100),
      setorAtual,
      completo: totalCount > 0 && doneCount === totalCount,
      prontoParaSolda,
    };
  });

  // "Fora de sequência": existe outra OP com numeroSequencia MAIOR que já
  // avançou mais etapas do que esta.
  return base.map((item) => {
    const ultrapassando = base
      .filter(
        (other) =>
          other.op.id !== item.op.id &&
          other.op.numeroSequencia > item.op.numeroSequencia &&
          other.doneCount > item.doneCount,
      )
      .sort((a, b) => b.doneCount - a.doneCount)[0];

    return {
      ...item,
      foraDeSequencia: Boolean(ultrapassando) && !item.completo,
      ultrapassadaPorSeq: ultrapassando ? ultrapassando.op.numeroSequencia : null,
    };
  });
}

/**
 * União das etapas pré-Solda usadas pelas OPs informadas, ordenada pela
 * ordem global do setor — usada como cabeçalho de colunas na tela de
 * Abastecimento (cada modelo pode ter um roteiro diferente).
 */
/**
 * União de TODAS as etapas dos roteiros das OPs informadas (inclui Solda,
 * Pintura, Montagem), ordenada pela ordem global do setor — usada como
 * cabeçalho de colunas na tela de Monitoramento (a "Produção Geral").
 */
export function colunasRoteiro(
  progresso: OPProgresso[],
): { setorId: number; setorNome: string; ordemPadrao: number }[] {
  const porId = new Map<number, { setorId: number; setorNome: string; ordemPadrao: number }>();
  for (const p of progresso) {
    for (const s of p.setores) {
      // "Abastecimento" é um checkpoint (kit completo), não etapa produtiva —
      // a matriz mostra essa informação na coluna Situação, não como coluna própria.
      if (ehSetor(s.setorNome, "Abastecimento")) continue;
      if (!porId.has(s.setorId)) {
        porId.set(s.setorId, {
          setorId: s.setorId,
          setorNome: s.setorNome,
          ordemPadrao: s.ordemPadrao,
        });
      }
    }
  }
  return [...porId.values()].sort((a, b) => a.ordemPadrao - b.ordemPadrao);
}

export function colunasPreSolda(
  progresso: OPProgresso[],
): { setorId: number; setorNome: string; ordemPadrao: number }[] {
  const porId = new Map<number, { setorId: number; setorNome: string; ordemPadrao: number }>();
  for (const p of progresso) {
    for (const s of p.setoresPreSolda) {
      if (!porId.has(s.setorId)) {
        porId.set(s.setorId, {
          setorId: s.setorId,
          setorNome: s.setorNome,
          ordemPadrao: s.ordemPadrao,
        });
      }
    }
  }
  return [...porId.values()].sort((a, b) => a.ordemPadrao - b.ordemPadrao);
}
