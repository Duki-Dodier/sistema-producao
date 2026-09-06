import { prisma } from "@/lib/prisma";

const STATUS_FINALIZADO = new Set(["CONCLUIDO", "CANCELADO"]);

export type LancamentoConferenciaFabrica = {
  id: number;
  nestItemId: number;
  nestId: number;
  nestCodigo: string;
  nestStatus: string;
  maquinaCodigo: string;
  maquinaNome: string;
  operadorId: number;
  operadorNome: string;
  dataHora: string;
  quantidadeBoa: number;
  quantidadeRefugo: number;
  apontamentoId: number | null;
  conferenteNome: string | null;
  conferidoEm: string | null;
  quantidadeConferidaBoa: number | null;
  quantidadeConferidaRefugo: number | null;
  motivoConferencia: string | null;
};

export type ItemConferenciaFabrica = {
  id: number;
  quantidadePlanejada: number;
  nestId: number;
  nestCodigo: string;
  nestStatus: string;
  maquinaCodigo: string;
  maquinaNome: string;
  lancamentos: LancamentoConferenciaFabrica[];
};

export type ConferenciaPlasmaFabrica = {
  opId: number;
  numeroSequencia: number;
  lote: string | null;
  modeloCodigo: string;
  modeloNome: string | null;
  pecaId: number;
  pecaCodigo: string;
  pecaNome: string;
  necessaria: number;
  totalPlanejado: number;
  totalDeclarado: number;
  totalBoasDeclaradas: number;
  totalPerdasDeclaradas: number;
  totalLiberado: number;
  totalPerdasLiberadas: number;
  pendentes: number;
  todosNestsFinalizados: boolean;
  itens: ItemConferenciaFabrica[];
};

export async function buscarConferenciaPlasmaFabrica({
  opId,
  pecaId,
  setorId,
}: {
  opId: number;
  pecaId: number;
  setorId: number;
}): Promise<ConferenciaPlasmaFabrica | null> {
  const [op, itens] = await Promise.all([
    prisma.oP.findUnique({
      where: { id: opId },
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
              where: { pecaId },
              select: {
                quantidadeNecessaria: true,
                peca: { select: { id: true, codigo: true, nome: true } },
              },
            },
          },
        },
      },
    }),
    prisma.nestItem.findMany({
      where: { opId, pecaId, nest: { setorId } },
      orderBy: [{ nestId: "asc" }, { id: "asc" }],
      select: {
        id: true,
        quantidadePlanejada: true,
        nest: {
          select: {
            id: true,
            codigo: true,
            status: true,
            maquina: { select: { codigo: true, nome: true } },
          },
        },
        lancamentos: {
          orderBy: [{ dataHora: "asc" }, { id: "asc" }],
          select: {
            id: true,
            nestItemId: true,
            funcionarioId: true,
            quantidadeBoa: true,
            quantidadeRefugo: true,
            dataHora: true,
            apontamentoId: true,
            quantidadeConferidaBoa: true,
            quantidadeConferidaRefugo: true,
            motivoConferencia: true,
            funcionario: { select: { nome: true } },
            conferente: { select: { nome: true } },
            conferidoEm: true,
          },
        },
      },
    }),
  ]);

  const componente = op?.modelo.pecas[0];
  if (!op || !componente || componente.peca.id !== pecaId) return null;

  const itensConvertidos = itens.map((item) => ({
    id: item.id,
    quantidadePlanejada: item.quantidadePlanejada,
    nestId: item.nest.id,
    nestCodigo: item.nest.codigo,
    nestStatus: item.nest.status,
    maquinaCodigo: item.nest.maquina.codigo,
    maquinaNome: item.nest.maquina.nome,
    lancamentos: item.lancamentos.map((lancamento) => ({
      id: lancamento.id,
      nestItemId: lancamento.nestItemId,
      nestId: item.nest.id,
      nestCodigo: item.nest.codigo,
      nestStatus: item.nest.status,
      maquinaCodigo: item.nest.maquina.codigo,
      maquinaNome: item.nest.maquina.nome,
      operadorId: lancamento.funcionarioId,
      operadorNome: lancamento.funcionario.nome,
      dataHora: lancamento.dataHora.toISOString(),
      quantidadeBoa: lancamento.quantidadeBoa,
      quantidadeRefugo: lancamento.quantidadeRefugo,
      apontamentoId: lancamento.apontamentoId,
      conferenteNome: lancamento.conferente?.nome ?? null,
      conferidoEm: lancamento.conferidoEm?.toISOString() ?? null,
      quantidadeConferidaBoa: lancamento.quantidadeConferidaBoa,
      quantidadeConferidaRefugo: lancamento.quantidadeConferidaRefugo,
      motivoConferencia: lancamento.motivoConferencia,
    })),
  }));

  const lancamentos = itensConvertidos.flatMap((item) => item.lancamentos);
  const totalDeclarado = lancamentos.reduce((soma, item) => soma + item.quantidadeBoa + item.quantidadeRefugo, 0);
  const totalBoasDeclaradas = lancamentos.reduce((soma, item) => soma + item.quantidadeBoa, 0);
  const totalPerdasDeclaradas = lancamentos.reduce((soma, item) => soma + item.quantidadeRefugo, 0);
  const totalLiberado = lancamentos.reduce((soma, item) => soma + (item.apontamentoId === null ? 0 : item.quantidadeConferidaBoa ?? item.quantidadeBoa), 0);
  const totalPerdasLiberadas = lancamentos.reduce((soma, item) => soma + (item.apontamentoId === null ? 0 : item.quantidadeConferidaRefugo ?? item.quantidadeRefugo), 0);

  return {
    opId: op.id,
    numeroSequencia: op.numeroSequencia,
    lote: op.lote,
    modeloCodigo: op.modelo.codigo,
    modeloNome: op.modelo.nome,
    pecaId,
    pecaCodigo: componente.peca.codigo,
    pecaNome: componente.peca.nome,
    necessaria: op.quantidade * componente.quantidadeNecessaria,
    totalPlanejado: itensConvertidos.reduce((soma, item) => soma + item.quantidadePlanejada, 0),
    totalDeclarado,
    totalBoasDeclaradas,
    totalPerdasDeclaradas,
    totalLiberado,
    totalPerdasLiberadas,
    pendentes: lancamentos.filter((item) => item.apontamentoId === null).length,
    todosNestsFinalizados: itensConvertidos.length > 0 && itensConvertidos.every((item) => STATUS_FINALIZADO.has(item.nestStatus)),
    itens: itensConvertidos,
  };
}
