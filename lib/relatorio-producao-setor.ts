import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { processosDaPeca } from "@/lib/processos";

export type PeriodoProducao = {
  ano: number;
  mes: number;
  mesInput: string;
  mesLabel: string;
  inicio: Date;
  fim: Date;
  diasNoMes: number;
};

function periodoProducao(mesInformado?: string): PeriodoProducao {
  const hoje = new Date();
  const [anoTexto, mesTexto] = (mesInformado ?? "").split("-");
  const ano = Number(anoTexto) || hoje.getFullYear();
  const mes = Number(mesTexto) || hoje.getMonth() + 1;
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);
  return {
    ano,
    mes,
    mesInput: `${ano}-${String(mes).padStart(2, "0")}`,
    mesLabel: inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    inicio,
    fim,
    diasNoMes: new Date(ano, mes, 0).getDate(),
  };
}

function dataInput(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function saidaFinal(apontamento: ApontamentoRelatorio) {
  if (apontamento.soldador) return false;
  if (apontamento.roteiroEtapa) {
    return !apontamento.roteiroEtapa.peca.roteiro.some(
      (etapa) =>
        etapa.setorId === apontamento.roteiroEtapa?.setorId &&
        etapa.ordem > apontamento.roteiroEtapa.ordem,
    );
  }
  if (!apontamento.pecaId || !apontamento.processo || !apontamento.peca) return true;
  return processosDaPeca(apontamento.peca).at(-1) === apontamento.processo;
}

async function buscarApontamentos(inicio: Date, fim: Date, setorId: number | null) {
  return prisma.apontamento.findMany({
    where: {
      dataHora: { gte: inicio, lt: fim },
      soldador: null,
      ...(setorId === null ? {} : { setorId }),
    },
    orderBy: { dataHora: "asc" },
    select: {
      opId: true,
      setorId: true,
      quantidadeBoa: true,
      dataHora: true,
      usuario: true,
      soldador: true,
      pecaId: true,
      processo: true,
      peca: {
        select: {
          nome: true,
          processos: true,
          tipoMaterial: true,
          setor: { select: { nome: true } },
        },
      },
      setor: { select: { nome: true } },
      roteiroEtapa: {
        select: {
          ordem: true,
          setorId: true,
          peca: {
            select: { roteiro: { select: { ordem: true, setorId: true } } },
          },
        },
      },
      op: {
        select: {
          numeroSequencia: true,
          lote: true,
          quantidade: true,
          modelo: { select: { codigo: true } },
        },
      },
    },
  });
}

type ApontamentoRelatorio = Awaited<ReturnType<typeof buscarApontamentos>>[number];

export async function relatorioProducaoSetor(setorId: number | null, mesInformado?: string) {
  const periodo = periodoProducao(mesInformado);
  const setores = await prisma.setor.findMany({
    orderBy: { ordemPadrao: "asc" },
    select: { id: true, nome: true, metaMensal: true },
  });
  const setor = setorId === null ? null : setores.find((item) => item.id === setorId) ?? null;
  const [apontamentos, funcionarios] = await Promise.all([
    buscarApontamentos(periodo.inicio, periodo.fim, setorId),
    setorId === null
      ? Promise.resolve([])
      : prisma.funcionario.findMany({
          where: { setorId, ativo: true },
          select: { nome: true },
          orderBy: { nome: "asc" },
        }),
  ]);
  const finalizados = apontamentos.filter(saidaFinal);

  const dias = Array.from({ length: periodo.diasNoMes }, (_, indice) => {
    const data = new Date(periodo.ano, periodo.mes - 1, indice + 1);
    return {
      dia: indice + 1,
      data: dataInput(data),
      label: `${String(indice + 1).padStart(2, "0")}/${String(periodo.mes).padStart(2, "0")}`,
    };
  });

  const grade = new Map<string, number>();
  const totaisPorOperador = new Map<string, number>();
  const diasPorOperador = new Map<string, Set<number>>();
  const totaisPorSetor = new Map<number, number>();
  const diasComProducao = new Set<number>();
  for (const item of finalizados) {
    const dia = item.dataHora.getDate();
    diasComProducao.add(dia);
    const chave = `${item.setorId}|${dia}|${item.usuario}`;
    grade.set(chave, (grade.get(chave) ?? 0) + item.quantidadeBoa);
    totaisPorOperador.set(item.usuario, (totaisPorOperador.get(item.usuario) ?? 0) + item.quantidadeBoa);
    const diasDoOperador = diasPorOperador.get(item.usuario) ?? new Set<number>();
    diasDoOperador.add(dia);
    diasPorOperador.set(item.usuario, diasDoOperador);
    totaisPorSetor.set(item.setorId, (totaisPorSetor.get(item.setorId) ?? 0) + item.quantidadeBoa);
  }

  const operadores = setorId === null
    ? [...new Set(finalizados.map((item) => item.usuario))].sort((a, b) => a.localeCompare(b, "pt-BR"))
    : [...new Set([
        ...funcionarios.map((item) => item.nome),
        ...finalizados.map((item) => item.usuario),
      ])].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const producaoDiaria = dias.map((dia) => {
    const valores = operadores.map((operador) =>
      finalizados
        .filter((item) => item.dataHora.getDate() === dia.dia && item.usuario === operador)
        .reduce((total, item) => total + item.quantidadeBoa, 0),
    );
    return {
      ...dia,
      valores,
      total: valores.reduce((total, valor) => total + valor, 0),
    };
  });

  const resumoOperadores = operadores.map((nome) => {
    const total = totaisPorOperador.get(nome) ?? 0;
    const diasTrabalhados = diasPorOperador.get(nome)?.size ?? 0;
    return {
      nome,
      total,
      diasTrabalhados,
      media: diasTrabalhados > 0 ? Math.round(total / diasTrabalhados) : 0,
    };
  });

  const setoresRelatorio = setores.map((item) => ({
    nome: item.nome,
    total: totaisPorSetor.get(item.id) ?? 0,
  }));

  const ordensMapa = new Map<string, {
    setor: string;
    numero: number;
    lote: string | null;
    codigo: string;
    quantidade: number;
    produzido: number;
  }>();
  for (const item of finalizados) {
    const chave = `${item.setorId}|${item.opId}`;
    const atual = ordensMapa.get(chave) ?? {
      setor: item.setor.nome,
      numero: item.op.numeroSequencia,
      lote: item.op.lote,
      codigo: item.op.modelo.codigo,
      quantidade: item.op.quantidade,
      produzido: 0,
    };
    atual.produzido += item.quantidadeBoa;
    ordensMapa.set(chave, atual);
  }

  return {
    setor,
    setores,
    periodo,
    total: finalizados.reduce((total, item) => total + item.quantidadeBoa, 0),
    diasComProducao: diasComProducao.size,
    operadores,
    producaoDiaria,
    resumoOperadores,
    setoresRelatorio,
    ordens: [...ordensMapa.values()].sort((a, b) => a.numero - b.numero || a.setor.localeCompare(b.setor, "pt-BR")),
  };
}

export function idSetorPorParametro(valor: string | null, setores: { id: number }[]) {
  if (!valor || valor === "geral") return null;
  const id = Number(valor);
  return Number.isInteger(id) && setores.some((setor) => setor.id === id) ? id : null;
}

export function nomeSetorRelatorio(nome: string | null | undefined) {
  if (!nome) return "Produção geral";
  return ehSetor(nome, "Componente Barra Chata e Cantoneira")
    ? "Componente Barra Chata e Cantoneira"
    : ehSetor(nome, "Componente Reforço")
      ? "Componente Reforço"
      : nome;
}
