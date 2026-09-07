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
  totalBoasPendentes: number;
  pendentes: number;
  todosNestsFinalizados: boolean;
  prontaParaConferir: boolean;
  itens: ItemConferenciaFabrica[];
};

export type ItemFilaConferenciaPlasma = {
  opId: number;
  numeroSequencia: number;
  lote: string | null;
  modeloCodigo: string;
  pecaId: number;
  pecaCodigo: string;
  pecaNome: string;
  necessaria: number;
  primeiroLancamentoEm: string;
};

function boasEfetivas(item: Pick<LancamentoConferenciaFabrica, "quantidadeBoa" | "quantidadeConferidaBoa">) {
  return item.quantidadeConferidaBoa ?? item.quantidadeBoa;
}

function perdasEfetivas(item: Pick<LancamentoConferenciaFabrica, "quantidadeRefugo" | "quantidadeConferidaRefugo">) {
  return item.quantidadeConferidaRefugo ?? item.quantidadeRefugo;
}

function resumirConferencia({
  opId,
  numeroSequencia,
  lote,
  modeloCodigo,
  modeloNome,
  pecaId,
  pecaCodigo,
  pecaNome,
  necessaria,
  itens,
}: Omit<ConferenciaPlasmaFabrica, "totalPlanejado" | "totalDeclarado" | "totalBoasDeclaradas" | "totalPerdasDeclaradas" | "totalLiberado" | "totalPerdasLiberadas" | "totalBoasPendentes" | "pendentes" | "todosNestsFinalizados" | "prontaParaConferir">): ConferenciaPlasmaFabrica {
  const lancamentos = itens.flatMap((item) => item.lancamentos);
  const pendentes = lancamentos.filter((item) => item.apontamentoId === null);
  const totalLiberado = lancamentos.reduce(
    (soma, item) => soma + (item.apontamentoId === null ? 0 : boasEfetivas(item)),
    0,
  );
  const totalPerdasLiberadas = lancamentos.reduce(
    (soma, item) => soma + (item.apontamentoId === null ? 0 : perdasEfetivas(item)),
    0,
  );
  const totalBoasPendentes = pendentes.reduce((soma, item) => soma + boasEfetivas(item), 0);
  const todosNestsFinalizados = itens.length > 0 && itens.every((item) => STATUS_FINALIZADO.has(item.nestStatus));

  return {
    opId,
    numeroSequencia,
    lote,
    modeloCodigo,
    modeloNome,
    pecaId,
    pecaCodigo,
    pecaNome,
    necessaria,
    totalPlanejado: itens.reduce((soma, item) => soma + item.quantidadePlanejada, 0),
    totalDeclarado: lancamentos.reduce((soma, item) => soma + item.quantidadeBoa + item.quantidadeRefugo, 0),
    totalBoasDeclaradas: lancamentos.reduce((soma, item) => soma + item.quantidadeBoa, 0),
    totalPerdasDeclaradas: lancamentos.reduce((soma, item) => soma + item.quantidadeRefugo, 0),
    totalLiberado,
    totalPerdasLiberadas,
    totalBoasPendentes,
    pendentes: pendentes.length,
    todosNestsFinalizados,
    prontaParaConferir: todosNestsFinalizados && pendentes.length > 0 && totalLiberado + totalBoasPendentes >= necessaria,
    itens,
  };
}

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

  const itensConvertidos: ItemConferenciaFabrica[] = itens.map((item) => ({
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

  return resumirConferencia({
    opId: op.id,
    numeroSequencia: op.numeroSequencia,
    lote: op.lote,
    modeloCodigo: op.modelo.codigo,
    modeloNome: op.modelo.nome,
    pecaId,
    pecaCodigo: componente.peca.codigo,
    pecaNome: componente.peca.nome,
    necessaria: op.quantidade * componente.quantidadeNecessaria,
    itens: itensConvertidos,
  });
}

/** Lista simplificada: uma peça por OP, pronta somente quando o corte está completo. */
export async function buscarFilaConferenciaPlasma(setorId: number): Promise<ItemFilaConferenciaPlasma[]> {
  const itens = await prisma.nestItem.findMany({
    where: { nest: { setorId }, op: { status: "ABERTA" } },
    orderBy: [{ opId: "asc" }, { pecaId: "asc" }, { nestId: "asc" }],
    select: {
      opId: true,
      pecaId: true,
      op: {
        select: {
          numeroSequencia: true,
          lote: true,
          quantidade: true,
          modelo: {
            select: {
              codigo: true,
              pecas: { select: { pecaId: true, quantidadeNecessaria: true } },
            },
          },
        },
      },
      peca: { select: { codigo: true, nome: true } },
      nest: { select: { status: true } },
      lancamentos: {
        orderBy: [{ dataHora: "asc" }, { id: "asc" }],
        select: {
          id: true,
          quantidadeBoa: true,
          apontamentoId: true,
          quantidadeConferidaBoa: true,
          dataHora: true,
        },
      },
    },
  });

  type ItemFilaBruto = (typeof itens)[number];
  const grupos = new Map<string, ItemFilaBruto[]>();
  for (const item of itens) {
    const chave = `${item.opId}:${item.pecaId}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }

  const fila: ItemFilaConferenciaPlasma[] = [];
  for (const grupo of grupos.values()) {
    const primeiro = grupo[0];
    const componente = primeiro.op.modelo.pecas.find((item) => item.pecaId === primeiro.pecaId);
    if (!componente) continue;
    const necessaria = primeiro.op.quantidade * componente.quantidadeNecessaria;
    const lancamentos = grupo.flatMap((item) => item.lancamentos);
    const pendentes = lancamentos.filter((item) => item.apontamentoId === null);
    const totalLiberado = lancamentos.reduce(
      (soma, item) => soma + (item.apontamentoId === null ? 0 : item.quantidadeConferidaBoa ?? item.quantidadeBoa),
      0,
    );
    const boasPendentes = pendentes.reduce((soma, item) => soma + (item.quantidadeConferidaBoa ?? item.quantidadeBoa), 0);
    const todosFinalizados = grupo.every((item) => STATUS_FINALIZADO.has(item.nest.status));
    if (!todosFinalizados || !pendentes.length || totalLiberado + boasPendentes < necessaria) continue;

    const primeiroLancamento = lancamentos[0]?.dataHora ?? new Date();
    fila.push({
      opId: primeiro.opId,
      numeroSequencia: primeiro.op.numeroSequencia,
      lote: primeiro.op.lote,
      modeloCodigo: primeiro.op.modelo.codigo,
      pecaId: primeiro.pecaId,
      pecaCodigo: primeiro.peca.codigo,
      pecaNome: primeiro.peca.nome,
      necessaria,
      primeiroLancamentoEm: primeiroLancamento.toISOString(),
    });
  }

  return fila.sort((a, b) => +new Date(a.primeiroLancamentoEm) - +new Date(b.primeiroLancamentoEm) || a.opId - b.opId || a.pecaId - b.pecaId);
}
