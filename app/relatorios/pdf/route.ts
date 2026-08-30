import { buscarOperadorLogado } from "@/lib/auth-operador";
import { gerarPdfRelatorio } from "@/lib/pdf-relatorio";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const numero = (valor: number, casas = 0) => valor.toLocaleString("pt-BR", {
  minimumFractionDigits: casas,
  maximumFractionDigits: casas,
});

function duracao(segundos: number) {
  if (!segundos || segundos <= 0) return "-";
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segundosRestantes = segundos % 60;
  if (horas > 0) return `${horas}h ${minutos}min`;
  if (minutos > 0) return `${minutos}min ${segundosRestantes}s`;
  return `${segundosRestantes}s`;
}

function dataHora(valor: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(valor);
}

function dataCurta(valor: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(valor);
}

function nomeArquivo(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function dataDoPeriodo(valor: string, fimDoDia = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T${fimDoDia ? "23:59:59.999" : "00:00:00.000"}-03:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

export async function GET(request: Request) {
  if (!(await buscarOperadorLogado())) {
    return new Response("Não autorizado", { status: 401 });
  }

  const url = new URL(request.url);
  const produto = (url.searchParams.get("produto") ?? "").trim();
  const operador = (url.searchParams.get("operador") ?? "").trim();
  const status = ["ABERTA", "CONCLUIDA", "CANCELADA"].includes(url.searchParams.get("status") ?? "") ? url.searchParams.get("status")! : "";
  const inicioTexto = (url.searchParams.get("inicio") ?? "").trim();
  const fimTexto = (url.searchParams.get("fim") ?? "").trim();
  const inicio = inicioTexto ? dataDoPeriodo(inicioTexto) : null;
  const fim = fimTexto ? dataDoPeriodo(fimTexto, true) : null;

  if (!produto && !operador) {
    return new Response("Selecione um produto ou operador para gerar o relatório.", { status: 400 });
  }
  if ((inicioTexto && !inicio) || (fimTexto && !fim)) {
    return new Response("Período inválido.", { status: 400 });
  }
  if (inicio && fim && inicio > fim) {
    return new Response("A data inicial não pode ser posterior à data final.", { status: 400 });
  }

  const filtroPeriodo = inicio || fim
    ? { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) }
    : null;

  const opRelacao = {
    ...(status ? { status } : {}),
    ...(produto ? { modelo: { codigo: produto } } : {}),
  };

  const filtroApontamentos = {
    tempoSegundos: { not: null },
    ...(filtroPeriodo ? { dataHora: filtroPeriodo } : {}),
    ...(Object.keys(opRelacao).length ? { op: opRelacao } : {}),
    ...(operador ? { usuario: operador } : {}),
  };
  const filtroOps = {
    ...(status ? { status } : {}),
    ...(produto ? { modelo: { codigo: produto } } : {}),
    apontamentos: {
      some: {
        tempoSegundos: { not: null },
        ...(filtroPeriodo ? { dataHora: filtroPeriodo } : {}),
        ...(operador ? { usuario: operador } : {}),
      },
    },
  };
  const filtroAtivos = {
    ...(filtroPeriodo ? { iniciadoEm: filtroPeriodo } : {}),
    ...(Object.keys(opRelacao).length ? { op: opRelacao } : {}),
    ...(operador ? { usuario: operador } : {}),
  };

  const [apontamentos, ops, processosAtivos] = await Promise.all([
    prisma.apontamento.findMany({
      where: filtroApontamentos,
      orderBy: { dataHora: "desc" },
      select: {
        opId: true,
        dataHora: true,
        processo: true,
        usuario: true,
        quantidadeBoa: true,
        tempoSegundos: true,
        setor: { select: { nome: true } },
        maquina: { select: { codigo: true } },
        peca: { select: { codigo: true, nome: true } },
        op: {
          select: {
            numeroSequencia: true,
            lote: true,
            quantidade: true,
            status: true,
            dataLiberacao: true,
            dataFinalizacao: true,
            modelo: { select: { codigo: true, nome: true } },
          },
        },
      },
    }),
    prisma.oP.findMany({
      where: filtroOps,
      orderBy: { dataLiberacao: "desc" },
      select: {
        id: true,
        numeroSequencia: true,
        lote: true,
        quantidade: true,
        status: true,
        dataLiberacao: true,
        dataFinalizacao: true,
        modelo: { select: { codigo: true, nome: true } },
      },
    }),
    prisma.producaoEmAndamento.findMany({
      where: filtroAtivos,
      orderBy: { iniciadoEm: "asc" },
      select: {
        iniciadoEm: true,
        usuario: true,
        processo: true,
        maquina: { select: { codigo: true } },
        setor: { select: { nome: true } },
        peca: { select: { codigo: true, nome: true } },
        op: { select: { numeroSequencia: true, modelo: { select: { codigo: true } } } },
      },
    }),
  ]);

  const resumoOps = new Map<number, {
    numero: number;
    lote: string | null;
    produto: string;
    quantidadePlanejada: number;
    status: string;
    producao: number;
    tempo: number;
    ultimaData: Date;
  }>();
  for (const op of ops) {
    resumoOps.set(op.id, {
      numero: op.numeroSequencia,
      lote: op.lote,
      produto: op.modelo.codigo,
      quantidadePlanejada: op.quantidade,
      status: op.status,
      producao: 0,
      tempo: 0,
      ultimaData: op.dataFinalizacao ?? op.dataLiberacao,
    });
  }

  const resumoPecas = new Map<string, {
    codigo: string;
    nome: string;
    setor: string;
    quantidade: number;
    tempo: number;
    apontamentos: number;
  }>();
  const resumoOperadores = new Map<string, { quantidade: number; tempo: number; apontamentos: number }>();
  const resumoProdutos = new Map<string, { quantidade: number; tempo: number; apontamentos: number; ops: Set<number> }>();

  let quantidadeTotal = 0;
  let tempoTotal = 0;
  for (const apontamento of apontamentos) {
    const tempo = apontamento.tempoSegundos ?? 0;
    quantidadeTotal += apontamento.quantidadeBoa;
    tempoTotal += tempo;

    const op = resumoOps.get(apontamento.opId);
    if (op) {
      op.producao += apontamento.quantidadeBoa;
      op.tempo += tempo;
      if (apontamento.dataHora > op.ultimaData) op.ultimaData = apontamento.dataHora;
    }

    const pecaCodigo = apontamento.peca?.codigo ?? "PRODUTO";
    const pecaNome = apontamento.peca?.nome ?? apontamento.op.modelo.nome ?? apontamento.op.modelo.codigo;
    const chavePeca = `${pecaCodigo}|${apontamento.setor.nome}`;
    const peca = resumoPecas.get(chavePeca) ?? {
      codigo: pecaCodigo,
      nome: pecaNome,
      setor: apontamento.setor.nome,
      quantidade: 0,
      tempo: 0,
      apontamentos: 0,
    };
    peca.quantidade += apontamento.quantidadeBoa;
    peca.tempo += tempo;
    peca.apontamentos += 1;
    resumoPecas.set(chavePeca, peca);

    const operadorResumo = resumoOperadores.get(apontamento.usuario) ?? { quantidade: 0, tempo: 0, apontamentos: 0 };
    operadorResumo.quantidade += apontamento.quantidadeBoa;
    operadorResumo.tempo += tempo;
    operadorResumo.apontamentos += 1;
    resumoOperadores.set(apontamento.usuario, operadorResumo);

    const produtoResumo = resumoProdutos.get(apontamento.op.modelo.codigo) ?? {
      quantidade: 0,
      tempo: 0,
      apontamentos: 0,
      ops: new Set<number>(),
    };
    produtoResumo.quantidade += apontamento.quantidadeBoa;
    produtoResumo.tempo += tempo;
    produtoResumo.apontamentos += 1;
    produtoResumo.ops.add(apontamento.opId);
    resumoProdutos.set(apontamento.op.modelo.codigo, produtoResumo);
  }

  const periodo = inicio || fim
    ? `${inicio ? dataCurta(inicio) : "Início"} a ${fim ? dataCurta(fim) : "Hoje"}`
    : apontamentos.length
      ? `${dataCurta(apontamentos.at(-1)!.dataHora)} a ${dataCurta(apontamentos[0].dataHora)}`
    : "Sem apontamentos no filtro";
  const filtro = [produto ? `Produto ${produto}` : "", operador ? `Operador ${operador}` : ""]
    .filter(Boolean)
    .join(" - ");
  const larguraTabela = 842 - 38 * 2;

  const pdf = gerarPdfRelatorio({
    titulo: "ENGATES BRUCKE - Sistema de Produção",
    subtitulo: `Relatório completo: ${filtro}`,
    periodo,
    orientacao: "paisagem",
    kpis: [
      { label: "Apontamentos", value: numero(apontamentos.length) },
      { label: "OPs analisadas", value: numero(resumoOps.size) },
      { label: "Produção apontada", value: numero(quantidadeTotal) },
      { label: "Tempo registrado", value: duracao(tempoTotal) },
      { label: "Tempo por unidade", value: quantidadeTotal > 0 ? duracao(Math.round(tempoTotal / quantidadeTotal)) : "-" },
      { label: "OPs concluídas", value: `${[...resumoOps.values()].filter((op) => op.status === "CONCLUIDA").length}/${resumoOps.size}` },
      { label: "Operadores", value: numero(resumoOperadores.size) },
      { label: "Processos ativos", value: numero(processosAtivos.length) },
    ],
    secoes: [
      {
        titulo: "Resumo por ordem de produção",
        colunas: [
          { titulo: "OP", largura: 52 },
          { titulo: "Lote", largura: 92 },
          { titulo: "Produto", largura: 112 },
          { titulo: "Planejado", largura: 77, alinhar: "right" },
          { titulo: "Apontado", largura: 77, alinhar: "right" },
          { titulo: "Tempo", largura: 92, alinhar: "right" },
          { titulo: "Situação", largura: 100 },
          { titulo: "Último apontamento", largura: larguraTabela - 602 },
        ],
        linhas: [...resumoOps.values()]
          .sort((a, b) => b.ultimaData.getTime() - a.ultimaData.getTime())
          .map((op) => [
            String(op.numero),
            op.lote ?? "-",
            op.produto,
            numero(op.quantidadePlanejada),
            numero(op.producao),
            duracao(op.tempo),
            op.status === "CONCLUIDA" ? "Concluída" : op.status === "CANCELADA" ? "Cancelada" : "Em produção",
            dataHora(op.ultimaData),
          ]),
      },
      {
        titulo: "Produção por peça e setor",
        colunas: [
          { titulo: "Código", largura: 92 },
          { titulo: "Peça", largura: 220 },
          { titulo: "Setor", largura: 152 },
          { titulo: "Apontamentos", largura: 98, alinhar: "right" },
          { titulo: "Quantidade", largura: 92, alinhar: "right" },
          { titulo: "Tempo", largura: 112, alinhar: "right" },
        ],
        linhas: [...resumoPecas.values()]
          .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"))
          .map((peca) => [peca.codigo, peca.nome, peca.setor, numero(peca.apontamentos), numero(peca.quantidade), duracao(peca.tempo)]),
      },
      {
        titulo: "Produtividade por operador",
        colunas: [
          { titulo: "Operador", largura: 295 },
          { titulo: "Apontamentos", largura: 130, alinhar: "right" },
          { titulo: "Quantidade", largura: 130, alinhar: "right" },
          { titulo: "Tempo", largura: 211, alinhar: "right" },
        ],
        linhas: [...resumoOperadores.entries()]
          .sort(([, a], [, b]) => b.quantidade - a.quantidade)
          .map(([nome, item]) => [nome, numero(item.apontamentos), numero(item.quantidade), duracao(item.tempo)]),
      },
      {
        titulo: "Produção por produto",
        colunas: [
          { titulo: "Produto", largura: 230 },
          { titulo: "OPs", largura: 106, alinhar: "right" },
          { titulo: "Apontamentos", largura: 140, alinhar: "right" },
          { titulo: "Quantidade", largura: 140, alinhar: "right" },
          { titulo: "Tempo", largura: 150, alinhar: "right" },
        ],
        linhas: [...resumoProdutos.entries()]
          .sort(([, a], [, b]) => b.quantidade - a.quantidade)
          .map(([codigo, item]) => [codigo, numero(item.ops.size), numero(item.apontamentos), numero(item.quantidade), duracao(item.tempo)]),
      },
      {
        titulo: "Apontamentos detalhados",
        paginaNovaAntes: true,
        colunas: [
          { titulo: "Data/hora", largura: 77 },
          { titulo: "OP", largura: 44 },
          { titulo: "Produto", largura: 72 },
          { titulo: "Peça", largura: 106 },
          { titulo: "Setor", largura: 82 },
          { titulo: "Processo", largura: 70 },
          { titulo: "Operador", largura: 90 },
          { titulo: "Máquina", largura: 55 },
          { titulo: "Qtd.", largura: 45, alinhar: "right" },
          { titulo: "Tempo", largura: 70, alinhar: "right" },
        ],
        linhas: apontamentos.map((item) => [
          dataHora(item.dataHora),
          String(item.op.numeroSequencia),
          item.op.modelo.codigo,
          item.peca ? `${item.peca.codigo} - ${item.peca.nome}` : "Produto principal",
          item.setor.nome,
          item.processo ?? "-",
          item.usuario,
          item.maquina?.codigo ?? "-",
          numero(item.quantidadeBoa),
          duracao(item.tempoSegundos ?? 0),
        ]),
      },
      {
        titulo: "Processos em andamento",
        colunas: [
          { titulo: "Iniciado em", largura: 122 },
          { titulo: "OP", largura: 55 },
          { titulo: "Produto", largura: 100 },
          { titulo: "Peça", largura: 165 },
          { titulo: "Setor", largura: 125 },
          { titulo: "Processo", largura: 105 },
          { titulo: "Operador", largura: 94 },
        ],
        linhas: processosAtivos.map((item) => [
          dataHora(item.iniciadoEm),
          String(item.op.numeroSequencia),
          item.op.modelo.codigo,
          item.peca ? `${item.peca.codigo} - ${item.peca.nome}` : "Produto principal",
          item.setor.nome,
          item.processo ?? "-",
          item.usuario,
        ]),
      },
    ],
  });

  const identificador = nomeArquivo([produto, operador].filter(Boolean).join("-") || "producao");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-producao-${identificador}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
