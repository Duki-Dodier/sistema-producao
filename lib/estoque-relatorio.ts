import { prisma } from "@/lib/prisma";

export type FiltrosEstoque = {
  codigo?: string;
  linha?: string;
  inicio?: string;
  fim?: string;
};

function dataFiltro(valor: string | undefined, fimDoDia = false) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const horario = fimDoDia ? "23:59:59.999" : "00:00:00.000";
  const data = new Date(`${valor}T${horario}-03:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function chaveDataBrasil(data: Date) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

export function formatarDataHoraEstoque(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

export async function montarRelatorioEstoque(filtros: FiltrosEstoque) {
  const codigo = (filtros.codigo ?? "").trim().toUpperCase();
  const linha = ["BRUCKE", "REFORCEL"].includes((filtros.linha ?? "").toUpperCase())
    ? (filtros.linha ?? "").toUpperCase()
    : "";
  const inicio = dataFiltro(filtros.inicio);
  const fim = dataFiltro(filtros.fim, true) ?? new Date();
  const periodoInvalido = Boolean(inicio && inicio > fim);

  const entradas = periodoInvalido
    ? []
    : await prisma.entradaEstoque.findMany({
        where: {
          dataHora: { lte: fim },
          ...(codigo || linha
            ? {
                op: {
                  modelo: {
                    ...(codigo ? { codigo: { contains: codigo } } : {}),
                    ...(linha ? { linhaProduto: linha } : {}),
                  },
                },
              }
            : {}),
        },
        orderBy: [{ dataHora: "desc" }, { id: "desc" }],
        select: {
          id: true,
          opId: true,
          quantidade: true,
          usuario: true,
          dataHora: true,
          op: {
            select: {
              numeroSequencia: true,
              lote: true,
              quantidade: true,
              status: true,
              dataFinalizacao: true,
              modeloId: true,
              modelo: {
                select: {
                  codigo: true,
                  nome: true,
                  linhaProduto: true,
                  estoqueMinimo: true,
                },
              },
            },
          },
        },
      });

  const movimentos = inicio
    ? entradas.filter((entrada) => entrada.dataHora >= inicio)
    : entradas;
  const totaisPorOp = new Map<number, number>();
  for (const entrada of entradas) {
    totaisPorOp.set(entrada.opId, (totaisPorOp.get(entrada.opId) ?? 0) + entrada.quantidade);
  }

  const porModelo = new Map<
    number,
    {
      modeloId: number;
      codigo: string;
      nome: string | null;
      linhaProduto: string;
      quantidade: number;
      ops: Set<number>;
      lotes: Set<string>;
      ultimaEntrada: Date;
    }
  >();
  for (const entrada of entradas) {
    const atual = porModelo.get(entrada.op.modeloId) ?? {
      modeloId: entrada.op.modeloId,
      codigo: entrada.op.modelo.codigo,
      nome: entrada.op.modelo.nome,
      linhaProduto: entrada.op.modelo.linhaProduto,
      quantidade: 0,
      ops: new Set<number>(),
      lotes: new Set<string>(),
      ultimaEntrada: entrada.dataHora,
    };
    atual.quantidade += entrada.quantidade;
    atual.ops.add(entrada.opId);
    if (entrada.op.lote) atual.lotes.add(entrada.op.lote);
    if (entrada.dataHora > atual.ultimaEntrada) atual.ultimaEntrada = entrada.dataHora;
    porModelo.set(entrada.op.modeloId, atual);
  }

  const resumo = [...porModelo.values()]
    .map((item) => ({
      ...item,
      ops: item.ops.size,
      lotes: item.lotes.size,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || a.codigo.localeCompare(b.codigo, "pt-BR"));

  const limiteSeteDias = new Date(fim);
  limiteSeteDias.setDate(limiteSeteDias.getDate() - 6);
  limiteSeteDias.setHours(0, 0, 0, 0);
  const porDia = new Map<string, number>();
  for (const entrada of entradas) {
    if (entrada.dataHora < limiteSeteDias) continue;
    const chave = chaveDataBrasil(entrada.dataHora);
    porDia.set(chave, (porDia.get(chave) ?? 0) + entrada.quantidade);
  }
  const dias = Array.from({ length: 7 }, (_, indice) => {
    const data = new Date(limiteSeteDias);
    data.setDate(data.getDate() + indice);
    const chave = chaveDataBrasil(data);
    return {
      chave,
      label: `${chave.slice(8, 10)}/${chave.slice(5, 7)}`,
      quantidade: porDia.get(chave) ?? 0,
    };
  });

  const movimentosDetalhados = movimentos.map((entrada) => ({
    ...entrada,
    totalRecebidoNaOp: totaisPorOp.get(entrada.opId) ?? 0,
    percentualOp: Math.min(
      Math.round(((totaisPorOp.get(entrada.opId) ?? 0) / Math.max(entrada.op.quantidade, 1)) * 100),
      100,
    ),
  }));
  const opsFinalizadas = new Set(
    entradas.filter((entrada) => entrada.op.status === "CONCLUIDA").map((entrada) => entrada.opId),
  ).size;

  return {
    filtros: {
      codigo,
      linha,
      inicioInput: filtros.inicio ?? "",
      fimInput: filtros.fim ?? "",
      inicio,
      fim,
    },
    periodoInvalido,
    resumo,
    movimentos: movimentosDetalhados,
    dias,
    totalAcumulado: entradas.reduce((total, entrada) => total + entrada.quantidade, 0),
    totalPeriodo: movimentos.reduce((total, entrada) => total + entrada.quantidade, 0),
    modelos: resumo.length,
    lotes: new Set(entradas.map((entrada) => entrada.op.lote).filter(Boolean)).size,
    opsFinalizadas,
  };
}
