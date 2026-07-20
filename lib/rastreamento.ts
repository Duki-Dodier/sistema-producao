import type { OPComDados } from "@/lib/pcp";
import { PROCESSO_LABEL, processosDaPeca, type Processo } from "@/lib/processos";
import { ehSetorFinal } from "@/lib/setores";

export type ProcessoProgresso = {
  codigo: Processo;
  nome: string;
  quantidade: number;
  necessaria: number;
  estado: "concluido" | "andamento" | "proximo" | "pendente";
};

export type PecaRastreada = {
  chave: string;
  id: number;
  codigo: string;
  nome: string;
  medida: string | null;
  setorId: number;
  setorNome: string;
  porEngate: number;
  necessaria: number;
  pronta: number;
  falta: number;
  processos: ProcessoProgresso[];
};

export type SetorRastreado = {
  setorId: number;
  setorNome: string;
  pecas: PecaRastreada[];
  necessaria: number;
  pronta: number;
  falta: number;
};

export type OPRastreada = {
  op: OPComDados;
  setores: SetorRastreado[];
  pecas: PecaRastreada[];
  progressoIndustrial: number;
  kitsCompletos: number;
  gargalo: PecaRastreada | null;
};

export function calcularRastreamento(ops: OPComDados[]): OPRastreada[] {
  return ops.map((op) => {
    const pecasOriginais = op.modelo.pecas
      .map((mp) => {
        const necessaria = op.quantidade * mp.quantidadeNecessaria;
        const etapasCadastradas = mp.peca.roteiro.filter(
          (etapa) => etapa.processo !== "AGRUPAR" && !ehSetorFinal(etapa.setor.nome),
        );
        const setorPrincipal = op.modelo.roteiro.find(
          (item) => item.setorId === mp.peca.setorId,
        )?.setor;
        const etapas = etapasCadastradas.length > 0
          ? etapasCadastradas.map((etapa) => ({
              id: etapa.id,
              setorId: etapa.setorId,
              setorNome: etapa.setor.nome,
              processo: etapa.processo as Processo,
              ordem: etapa.ordem,
            }))
          : setorPrincipal && !ehSetorFinal(setorPrincipal.nome)
            ? processosDaPeca({ ...mp.peca, setor: setorPrincipal }).map((processo, indice) => ({
                id: null,
                setorId: setorPrincipal.id,
                setorNome: setorPrincipal.nome,
                processo,
                ordem: indice + 1,
              }))
            : [];

        const quantidades = etapas.map((etapa) => {
          const legada = op.apontamentos
            .filter(
              (apontamento) =>
                apontamento.pecaId === mp.pecaId &&
                apontamento.setorId === etapa.setorId &&
                apontamento.processo === null,
            )
            .reduce((soma, apontamento) => soma + apontamento.quantidadeBoa, 0);
          const apontada = op.apontamentos
            .filter(
              (apontamento) =>
                apontamento.pecaId === mp.pecaId &&
                (etapa.id !== null
                  ? apontamento.roteiroEtapaId === etapa.id ||
                    (apontamento.roteiroEtapaId === null &&
                      apontamento.setorId === etapa.setorId &&
                      apontamento.processo === etapa.processo)
                  : apontamento.setorId === etapa.setorId &&
                    apontamento.processo === etapa.processo),
            )
            .reduce((soma, apontamento) => soma + apontamento.quantidadeBoa, 0);
          return Math.min(necessaria, legada + apontada);
        });
        const primeiroIncompleto = quantidades.findIndex((qtd) => qtd < necessaria);
        const processos = etapas.map((etapa, index) => {
          const quantidade = quantidades[index] ?? 0;
          const estado: ProcessoProgresso["estado"] =
            quantidade >= necessaria
              ? "concluido"
              : quantidade > 0
                ? "andamento"
                : index === primeiroIncompleto
                  ? "proximo"
                  : "pendente";
          return {
            ...etapa,
            codigo: etapa.processo,
            nome: PROCESSO_LABEL[etapa.processo],
            quantidade,
            necessaria,
            estado,
          };
        });
        const porSetor = new Map<number, typeof processos>();
        for (const processo of processos) {
          const atuais = porSetor.get(processo.setorId) ?? [];
          atuais.push(processo);
          porSetor.set(processo.setorId, atuais);
        }

        const setores = [...porSetor.entries()].map(([setorId, processosDoSetor]) => {
          const pronta = processosDoSetor.at(-1)?.quantidade ?? 0;
          return {
            chave: `${mp.pecaId}-${setorId}`,
            id: mp.pecaId,
            codigo: mp.peca.codigo,
            nome: mp.peca.nome,
            medida: mp.peca.medida,
            setorId,
            setorNome: processosDoSetor[0].setorNome,
            porEngate: mp.quantidadeNecessaria,
            necessaria,
            pronta,
            falta: Math.max(necessaria - pronta, 0),
            processos: processosDoSetor.map(({ codigo, nome, quantidade, necessaria: total, estado }) => ({
              codigo,
              nome,
              quantidade,
              necessaria: total,
              estado,
            })),
          } satisfies PecaRastreada;
        });

        return {
          setores,
          porEngate: mp.quantidadeNecessaria,
          prontaFinal: quantidades.at(-1) ?? 0,
        };
      })
      .filter((peca) => peca.setores.length > 0);
    const pecas = pecasOriginais.flatMap((peca) => peca.setores);

    const porSetor = new Map<number, SetorRastreado>();
    for (const peca of pecas) {
      const atual = porSetor.get(peca.setorId) ?? {
        setorId: peca.setorId,
        setorNome: peca.setorNome,
        pecas: [],
        necessaria: 0,
        pronta: 0,
        falta: 0,
      };
      atual.pecas.push(peca);
      atual.necessaria += peca.necessaria;
      atual.pronta += peca.pronta;
      atual.falta += peca.falta;
      porSetor.set(peca.setorId, atual);
    }

    const totalEtapas = pecas.reduce(
      (soma, peca) => soma + peca.necessaria * peca.processos.length,
      0,
    );
    const etapasFeitas = pecas.reduce(
      (soma, peca) => soma + peca.processos.reduce((sub, processo) => sub + processo.quantidade, 0),
      0,
    );
    const kitsCompletos =
      pecasOriginais.length === 0
        ? 0
        : Math.min(
            ...pecasOriginais.map((peca) => Math.floor(peca.prontaFinal / peca.porEngate)),
          );
    const candidatasGargalo = pecas.filter(
      (peca) =>
        peca.falta > 0 &&
        peca.processos.some((processo) => processo.estado === "proximo" || processo.estado === "andamento"),
    );
    const gargalo = [...(candidatasGargalo.length > 0 ? candidatasGargalo : pecas)]
      .filter((peca) => peca.falta > 0)
      .sort((a, b) => b.falta / b.necessaria - a.falta / a.necessaria)[0] ?? null;

    const ordemSetores = new Map(
      op.modelo.roteiro.map((etapa, indice) => [etapa.setorId, indice]),
    );

    return {
      op,
      setores: [...porSetor.values()].sort(
        (a, b) =>
          (ordemSetores.get(a.setorId) ?? Number.MAX_SAFE_INTEGER) -
          (ordemSetores.get(b.setorId) ?? Number.MAX_SAFE_INTEGER),
      ),
      pecas,
      progressoIndustrial: totalEtapas === 0 ? 0 : Math.round((etapasFeitas / totalEtapas) * 100),
      kitsCompletos,
      gargalo,
    };
  });
}
