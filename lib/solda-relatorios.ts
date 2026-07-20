import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

export type PeriodoRelatorio = {
  inicio: Date;
  fim: Date;
  inicioInput: string;
  fimInput: string;
};

type ApontamentoComModelo = Awaited<ReturnType<typeof buscarProducao>>[number];
type EnvioComModelo = Awaited<ReturnType<typeof buscarEnvios>>[number];

function inputData(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function periodoRelatorio(inicio?: string, fim?: string): PeriodoRelatorio {
  const hoje = new Date();
  const inicioPadrao = new Date(hoje);
  inicioPadrao.setDate(inicioPadrao.getDate() - 29);
  const inicioInput = inicio || inputData(inicioPadrao);
  const fimInput = fim || inputData(hoje);
  return {
    inicio: new Date(`${inicioInput}T00:00:00`),
    fim: new Date(`${fimInput}T23:59:59.999`),
    inicioInput,
    fimInput,
  };
}

function chaveDia(data: Date) {
  return inputData(data);
}

function rotuloDia(chave: string) {
  const [, mes, dia] = chave.split("-");
  return `${dia}/${mes}`;
}

function agruparPorDia(apontamentos: ApontamentoComModelo[]) {
  const mapa = new Map<string, number>();
  for (const item of apontamentos) {
    const chave = chaveDia(item.dataHora);
    mapa.set(chave, (mapa.get(chave) ?? 0) + item.quantidadeBoa);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, quantidade]) => ({ data, label: rotuloDia(data), quantidade }));
}

function extremosDosDias(dias: ReturnType<typeof agruparPorDia>) {
  if (dias.length === 0) return { melhorDia: null, piorDia: null };
  const ordenados = [...dias].sort(
    (a, b) => b.quantidade - a.quantidade || a.data.localeCompare(b.data),
  );
  const piores = [...dias].sort(
    (a, b) => a.quantidade - b.quantidade || a.data.localeCompare(b.data),
  );
  return { melhorDia: ordenados[0], piorDia: piores[0] };
}

async function setorSoldaId() {
  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  return setores.find((setor) => ehSetor(setor.nome, "Solda"))?.id ?? -1;
}

async function buscarEnvios(setorId: number, inicio: Date, fim: Date, soldador?: string) {
  return prisma.apontamento.findMany({
    where: {
      setorId,
      soldador: soldador ? soldador : { not: null },
      dataHora: { gte: inicio, lte: fim },
    },
    orderBy: { dataHora: "asc" },
    include: { op: { include: { modelo: true } } },
  });
}

async function buscarProducao(setorId: number, inicio: Date, fim: Date, soldador?: string) {
  return prisma.apontamento.findMany({
    where: {
      setorId,
      soldador: null,
      ...(soldador ? { usuario: soldador } : {}),
      dataHora: { gte: inicio, lte: fim },
    },
    orderBy: { dataHora: "asc" },
    include: { op: { include: { modelo: true } } },
  });
}

export async function listarSoldadoresDaSolda() {
  const setorId = await setorSoldaId();
  const [envios, producao] = await Promise.all([
    prisma.apontamento.findMany({
      where: { setorId, soldador: { not: null } },
      select: { soldador: true },
      distinct: ["soldador"],
    }),
    prisma.apontamento.findMany({
      where: { setorId, soldador: null },
      select: { usuario: true },
      distinct: ["usuario"],
    }),
  ]);
  return [...new Set([
    ...envios.map((item) => item.soldador).filter(Boolean),
    ...producao.map((item) => item.usuario).filter(Boolean),
  ] as string[])].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function relatorioDoSoldador(
  soldador: string,
  periodo: PeriodoRelatorio,
) {
  const setorId = await setorSoldaId();
  const [envios, producao] = await Promise.all([
    buscarEnvios(setorId, periodo.inicio, periodo.fim, soldador),
    buscarProducao(setorId, periodo.inicio, periodo.fim, soldador),
  ]);

  const totalSoldado = producao.reduce((soma, item) => soma + item.quantidadeBoa, 0);
  const totalRecebido = envios.reduce((soma, item) => soma + item.quantidadeBoa, 0);
  const dias = agruparPorDia(producao);
  const diasTrabalhados = dias.length;
  const mediaDia = diasTrabalhados > 0 ? totalSoldado / diasTrabalhados : 0;
  const opsAtendidas = new Set(producao.map((item) => item.opId)).size;
  const bancadas = [...new Set(envios.map((item) => item.bancada).filter(Boolean) as string[])];
  const { melhorDia, piorDia } = extremosDosDias(dias);

  const recebidosPorCodigo = new Map<string, { quantidade: number; envios: number }>();
  for (const item of envios) {
    const codigo = item.op.modelo.codigo;
    const atual = recebidosPorCodigo.get(codigo) ?? { quantidade: 0, envios: 0 };
    atual.quantidade += item.quantidadeBoa;
    atual.envios += 1;
    recebidosPorCodigo.set(codigo, atual);
  }

  const codigosMapa = new Map<string, {
    codigo: string;
    nome: string | null;
    soldadas: number;
    recebidas: number;
    envios: number;
    ops: Set<number>;
    ultimoApontamento: Date;
  }>();
  for (const item of producao) {
    const codigo = item.op.modelo.codigo;
    const recebimento = recebidosPorCodigo.get(codigo);
    const atual = codigosMapa.get(codigo) ?? {
      codigo,
      nome: item.op.modelo.nome,
      soldadas: 0,
      recebidas: recebimento?.quantidade ?? 0,
      envios: recebimento?.envios ?? 0,
      ops: new Set<number>(),
      ultimoApontamento: item.dataHora,
    };
    atual.soldadas += item.quantidadeBoa;
    atual.ops.add(item.opId);
    if (item.dataHora > atual.ultimoApontamento) atual.ultimoApontamento = item.dataHora;
    codigosMapa.set(codigo, atual);
  }
  for (const item of envios) {
    const codigo = item.op.modelo.codigo;
    if (!codigosMapa.has(codigo)) {
      const recebimento = recebidosPorCodigo.get(codigo)!;
      codigosMapa.set(codigo, {
        codigo,
        nome: item.op.modelo.nome,
        soldadas: 0,
        recebidas: recebimento.quantidade,
        envios: recebimento.envios,
        ops: new Set<number>(),
        ultimoApontamento: item.dataHora,
      });
    }
  }
  const codigos = [...codigosMapa.values()]
    .map((item) => ({
      ...item,
      ops: item.ops.size,
      saldo: Math.max(item.recebidas - item.soldadas, 0),
      percentual: item.recebidas > 0 ? Math.round((item.soldadas / item.recebidas) * 100) : 0,
    }))
    .sort((a, b) => b.soldadas - a.soldadas || a.codigo.localeCompare(b.codigo));

  const opsMapa = new Map<number, {
    opId: number;
    numero: number;
    codigo: string;
    nome: string | null;
    soldadas: number;
    dias: Set<string>;
    primeiro: Date;
    ultimo: Date;
  }>();
  for (const item of producao) {
    const atual = opsMapa.get(item.opId) ?? {
      opId: item.opId,
      numero: item.op.numeroSequencia,
      codigo: item.op.modelo.codigo,
      nome: item.op.modelo.nome,
      soldadas: 0,
      dias: new Set<string>(),
      primeiro: item.dataHora,
      ultimo: item.dataHora,
    };
    atual.soldadas += item.quantidadeBoa;
    atual.dias.add(chaveDia(item.dataHora));
    if (item.dataHora < atual.primeiro) atual.primeiro = item.dataHora;
    if (item.dataHora > atual.ultimo) atual.ultimo = item.dataHora;
    opsMapa.set(item.opId, atual);
  }
  const ops = [...opsMapa.values()]
    .map((item) => ({ ...item, dias: item.dias.size }))
    .sort((a, b) => b.soldadas - a.soldadas);

  return {
    soldador,
    periodo,
    totalSoldado,
    totalRecebido,
    saldoPeriodo: Math.max(totalRecebido - totalSoldado, 0),
    diasTrabalhados,
    mediaDia,
    opsAtendidas,
    bancadas,
    melhorDia,
    piorDia,
    dias,
    codigos,
    codigoMaisSoldado: codigos[0] ?? null,
    ops,
  };
}

export async function relatorioGeralSolda(periodo: PeriodoRelatorio) {
  const setorId = await setorSoldaId();
  const [envios, producao, enviosTodos, producaoToda] = await Promise.all([
    buscarEnvios(setorId, periodo.inicio, periodo.fim),
    buscarProducao(setorId, periodo.inicio, periodo.fim),
    prisma.apontamento.findMany({
      where: { setorId, soldador: { not: null } },
      include: { op: { include: { modelo: true } } },
    }),
    prisma.apontamento.findMany({
      where: { setorId, soldador: null },
      include: { op: { include: { modelo: true } } },
    }),
  ]);

  const totalSoldado = producao.reduce((soma, item) => soma + item.quantidadeBoa, 0);
  const totalRecebido = envios.reduce((soma, item) => soma + item.quantidadeBoa, 0);
  const dias = agruparPorDia(producao);
  const diasTrabalhados = dias.length;
  const mediaDia = diasTrabalhados > 0 ? totalSoldado / diasTrabalhados : 0;
  const { melhorDia, piorDia } = extremosDosDias(dias);
  const opsAtendidas = new Set(producao.map((item) => item.opId)).size;
  const soldadoresAtivos = new Set(producao.map((item) => item.usuario)).size;

  const rankingMapa = new Map<string, {
    soldador: string;
    soldadas: number;
    dias: Set<string>;
    ops: Set<number>;
    codigos: Map<string, number>;
  }>();
  for (const item of producao) {
    const atual = rankingMapa.get(item.usuario) ?? {
      soldador: item.usuario,
      soldadas: 0,
      dias: new Set<string>(),
      ops: new Set<number>(),
      codigos: new Map<string, number>(),
    };
    atual.soldadas += item.quantidadeBoa;
    atual.dias.add(chaveDia(item.dataHora));
    atual.ops.add(item.opId);
    const codigo = item.op.modelo.codigo;
    atual.codigos.set(codigo, (atual.codigos.get(codigo) ?? 0) + item.quantidadeBoa);
    rankingMapa.set(item.usuario, atual);
  }
  const ranking = [...rankingMapa.values()]
    .map((item) => {
      const principal = [...item.codigos.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        soldador: item.soldador,
        soldadas: item.soldadas,
        dias: item.dias.size,
        media: item.dias.size > 0 ? item.soldadas / item.dias.size : 0,
        ops: item.ops.size,
        codigoPrincipal: principal?.[0] ?? "-",
        quantidadePrincipal: principal?.[1] ?? 0,
      };
    })
    .sort((a, b) => b.soldadas - a.soldadas);

  const codigosMapa = new Map<string, { codigo: string; nome: string | null; soldadas: number; ops: Set<number>; soldadores: Set<string> }>();
  for (const item of producao) {
    const codigo = item.op.modelo.codigo;
    const atual = codigosMapa.get(codigo) ?? {
      codigo,
      nome: item.op.modelo.nome,
      soldadas: 0,
      ops: new Set<number>(),
      soldadores: new Set<string>(),
    };
    atual.soldadas += item.quantidadeBoa;
    atual.ops.add(item.opId);
    atual.soldadores.add(item.usuario);
    codigosMapa.set(codigo, atual);
  }
  const codigos = [...codigosMapa.values()]
    .map((item) => ({ ...item, ops: item.ops.size, soldadores: item.soldadores.size }))
    .sort((a, b) => b.soldadas - a.soldadas);

  const enviadoPorOp = new Map<number, EnvioComModelo>();
  const totalEnviadoPorOp = new Map<number, number>();
  for (const item of enviosTodos) {
    enviadoPorOp.set(item.opId, item);
    totalEnviadoPorOp.set(item.opId, (totalEnviadoPorOp.get(item.opId) ?? 0) + item.quantidadeBoa);
  }
  const totalSoldadoPorOp = new Map<number, number>();
  for (const item of producaoToda) {
    totalSoldadoPorOp.set(item.opId, (totalSoldadoPorOp.get(item.opId) ?? 0) + item.quantidadeBoa);
  }
  const aguardandoPorOp = [...totalEnviadoPorOp.entries()]
    .map(([opId, recebido]) => {
      const referencia = enviadoPorOp.get(opId)!;
      const soldado = totalSoldadoPorOp.get(opId) ?? 0;
      return {
        opId,
        numero: referencia.op.numeroSequencia,
        codigo: referencia.op.modelo.codigo,
        nome: referencia.op.modelo.nome,
        recebido,
        soldado,
        aguardando: Math.max(recebido - soldado, 0),
      };
    })
    .filter((item) => item.aguardando > 0)
    .sort((a, b) => b.aguardando - a.aguardando);
  const aguardandoSolda = aguardandoPorOp.reduce((soma, item) => soma + item.aguardando, 0);

  return {
    periodo,
    totalSoldado,
    totalRecebido,
    diasTrabalhados,
    mediaDia,
    melhorDia,
    piorDia,
    opsAtendidas,
    soldadoresAtivos,
    conversao: totalRecebido > 0 ? Math.round((totalSoldado / totalRecebido) * 100) : 0,
    aguardandoSolda,
    opsAguardando: aguardandoPorOp.length,
    dias,
    ranking,
    codigos,
    codigoMaisSoldado: codigos[0] ?? null,
    aguardandoPorOp,
  };
}
