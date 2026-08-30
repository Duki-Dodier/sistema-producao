import { buscarOperadorLogado } from "@/lib/auth-operador";
import { gerarPdfRelatorio } from "@/lib/pdf-relatorio";
import { STATUS_OP_LABEL, TIPO_LABEL, TIPO_MATERIAL_LABEL } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const numero = (valor: number, casas = 0) => valor.toLocaleString("pt-BR", {
  minimumFractionDigits: casas,
  maximumFractionDigits: casas,
});

function dataHora(valor: Date | null | undefined) {
  if (!valor) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(valor);
}

function dataCurta(valor: Date | null | undefined) {
  if (!valor) return "-";
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

function duracao(segundos: number) {
  if (!segundos || segundos <= 0) return "-";
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min ${segundos % 60}s`;
}

function dimensoes(peca: {
  medida: string | null;
  medidaA: number | null;
  medidaB: number | null;
  espessuraMm: number | null;
  comprimentoMm: number | null;
}) {
  const estruturadas = [
    peca.medidaA !== null ? `${numero(peca.medidaA, 1)}mm` : "",
    peca.medidaB !== null ? `${numero(peca.medidaB, 1)}mm` : "",
    peca.espessuraMm !== null ? `esp. ${numero(peca.espessuraMm, 1)}mm` : "",
    peca.comprimentoMm !== null ? `C ${numero(peca.comprimentoMm, 1)}mm` : "",
  ].filter(Boolean);
  return estruturadas.length > 0 ? estruturadas.join(" x ") : peca.medida ?? "-";
}

function processoLabel(processo: string) {
  const labels: Record<string, string> = {
    PRODUCAO: "Produção",
    CORTE: "Corte",
    BATIDA: "Batida",
    FURACAO: "Furação",
    DOBRA: "Dobra",
    AMASSAR: "Amassar",
    CORTE_GRAU: "Corte em grau",
    LIXAR: "Lixar",
    SOLDAGEM: "Soldagem",
    AGRUPAR: "Agrupar",
  };
  return labels[processo] ?? processo;
}

function tipoMaterialLabel(tipo: string | null) {
  return tipo ? (TIPO_MATERIAL_LABEL[tipo] ?? tipo) : "-";
}

export async function GET(request: Request) {
  if (!(await buscarOperadorLogado())) {
    return new Response("Não autorizado", { status: 401 });
  }

  const url = new URL(request.url);
  const modeloIdTexto = (url.searchParams.get("modeloId") ?? "").trim();
  const modeloId = Number(modeloIdTexto);
  if (!modeloIdTexto || !Number.isInteger(modeloId) || modeloId <= 0) {
    return new Response("Selecione um engate válido para gerar a ficha.", { status: 400 });
  }

  const modelo = await prisma.modelo.findUnique({
    where: { id: modeloId },
    select: {
      id: true,
      codigo: true,
      nome: true,
      curva: true,
      tipo: true,
      tamanhoPonteira: true,
      estoqueMinimo: true,
      linhaProduto: true,
      createdAt: true,
      updatedAt: true,
      pecas: {
        orderBy: { id: "asc" },
        select: {
          quantidadeNecessaria: true,
          peca: {
            select: {
              codigo: true,
              nome: true,
              medida: true,
              medidaA: true,
              medidaB: true,
              espessuraMm: true,
              comprimentoMm: true,
              tipoMaterial: true,
              processos: true,
              setor: { select: { nome: true } },
              roteiro: {
                orderBy: { ordem: "asc" },
                select: { ordem: true, processo: true },
              },
            },
          },
        },
      },
      ops: {
        orderBy: { numeroSequencia: "asc" },
        select: {
          id: true,
          numeroSequencia: true,
          lote: true,
          quantidade: true,
          status: true,
          dataLiberacao: true,
          dataFinalizacao: true,
        },
      },
    },
  });

  if (!modelo) return new Response("Engate não encontrado.", { status: 404 });

  const apontamentos = await prisma.apontamento.findMany({
    where: { op: { modeloId: modelo.id } },
    orderBy: { dataHora: "desc" },
    select: {
      opId: true,
      dataHora: true,
      processo: true,
      usuario: true,
      quantidadeBoa: true,
      quantidadeRefugo: true,
      tempoSegundos: true,
      setor: { select: { nome: true } },
      maquina: { select: { codigo: true } },
      peca: { select: { codigo: true, nome: true } },
      op: { select: { numeroSequencia: true } },
    },
  });

  const resumoOps = new Map<number, {
    numero: number;
    lote: string | null;
    quantidade: number;
    status: string;
    liberacao: Date;
    finalizacao: Date | null;
    boas: number;
    refugo: number;
    tempo: number;
  }>();
  for (const op of modelo.ops) {
    resumoOps.set(op.id, {
      numero: op.numeroSequencia,
      lote: op.lote,
      quantidade: op.quantidade,
      status: op.status,
      liberacao: op.dataLiberacao,
      finalizacao: op.dataFinalizacao,
      boas: 0,
      refugo: 0,
      tempo: 0,
    });
  }

  let quantidadeBoa = 0;
  let quantidadeRefugo = 0;
  let tempoTotal = 0;
  for (const apontamento of apontamentos) {
    quantidadeBoa += apontamento.quantidadeBoa;
    quantidadeRefugo += apontamento.quantidadeRefugo;
    tempoTotal += apontamento.tempoSegundos ?? 0;
    const resumo = resumoOps.get(apontamento.opId);
    if (resumo) {
      resumo.boas += apontamento.quantidadeBoa;
      resumo.refugo += apontamento.quantidadeRefugo;
      resumo.tempo += apontamento.tempoSegundos ?? 0;
    }
  }

  const tipo = TIPO_LABEL[modelo.tipo] ?? modelo.tipo;
  const ponteira = modelo.tamanhoPonteira
    ? modelo.tamanhoPonteira.charAt(0) + modelo.tamanhoPonteira.slice(1).toLocaleLowerCase("pt-BR")
    : "Não se aplica";
  const curva = modelo.curva || "Não informada";
  const larguraTabela = 842 - 38 * 2;

  const pdf = gerarPdfRelatorio({
    titulo: "ENGATES BRUCKE - Sistema de Produção",
    subtitulo: `Ficha completa do engate ${modelo.codigo}`,
    periodo: `Emitido em ${dataHora(new Date())}`,
    orientacao: "paisagem",
    kpis: [
      { label: "OPs do modelo", value: numero(modelo.ops.length) },
      { label: "Quantidade planejada", value: numero(modelo.ops.reduce((total, op) => total + op.quantidade, 0)) },
      { label: "Produção boa", value: numero(quantidadeBoa) },
      { label: "Refugo apontado", value: numero(quantidadeRefugo) },
      { label: "Tempo registrado", value: duracao(tempoTotal) },
      { label: "Estoque regulador", value: modelo.estoqueMinimo === null ? "-" : numero(modelo.estoqueMinimo) },
      { label: "Itens na BOM", value: numero(modelo.pecas.length) },
      { label: "Apontamentos", value: numero(apontamentos.length) },
    ],
    secoes: [
      {
        titulo: "Identificação e parâmetros técnicos",
        colunas: [
          { titulo: "Campo", largura: 190 },
          { titulo: "Informação", largura: larguraTabela - 190 },
        ],
        linhas: [
          ["Código do engate", modelo.codigo],
          ["Descrição", modelo.nome ?? "Não informada"],
          ["Linha de produto", modelo.linhaProduto],
          ["Tipo", tipo],
          ["Curva ABC", curva],
          ["Ponteira", ponteira],
          ["Estoque regulador", modelo.estoqueMinimo === null ? "Não informado" : numero(modelo.estoqueMinimo)],
          ["Cadastro atualizado", dataHora(modelo.updatedAt)],
        ],
      },
      {
        titulo: "BOM - lista de materiais do engate",
        quebrarLinhas: true,
        colunas: [
          { titulo: "Código", largura: 92 },
          { titulo: "Descrição", largura: 180 },
          { titulo: "Material", largura: 75 },
          { titulo: "Dimensões", largura: 132 },
          { titulo: "Qtde/eng.", largura: 64, alinhar: "right" },
          { titulo: "Setor", largura: 105 },
          { titulo: "Processos", largura: larguraTabela - 648 },
        ],
        linhas: modelo.pecas.map((item) => [
          item.peca.codigo,
          item.peca.nome,
          tipoMaterialLabel(item.peca.tipoMaterial),
          dimensoes(item.peca),
          numero(item.quantidadeNecessaria),
          item.peca.setor.nome,
          item.peca.roteiro.length
            ? item.peca.roteiro.map((etapa) => `${etapa.ordem}. ${processoLabel(etapa.processo)}`).join(" -> ")
            : item.peca.processos
              ? item.peca.processos.split(",").map((processo) => processoLabel(processo.trim())).join(" -> ")
              : "Não informado",
        ]),
      },
      {
        titulo: "Ordens de produção do engate",
        colunas: [
          { titulo: "OP", largura: 48 },
          { titulo: "Lote", largura: 105 },
          { titulo: "Planejado", largura: 70, alinhar: "right" },
          { titulo: "Boas", largura: 64, alinhar: "right" },
          { titulo: "Refugo", largura: 64, alinhar: "right" },
          { titulo: "Situação", largura: 91 },
          { titulo: "Liberada em", largura: 90 },
          { titulo: "Finalizada em", largura: 90 },
          { titulo: "Tempo apontado", largura: larguraTabela - 622, alinhar: "right" },
        ],
        linhas: [...resumoOps.values()].map((op) => [
          String(op.numero),
          op.lote ?? "-",
          numero(op.quantidade),
          numero(op.boas),
          numero(op.refugo),
          STATUS_OP_LABEL[op.status] ?? op.status,
          dataCurta(op.liberacao),
          dataCurta(op.finalizacao),
          duracao(op.tempo),
        ]),
      },
      {
        titulo: "Apontamentos e rastreabilidade",
        paginaNovaAntes: true,
        colunas: [
          { titulo: "Data/hora", largura: 82 },
          { titulo: "OP", largura: 42 },
          { titulo: "Peça", largura: 145 },
          { titulo: "Setor", largura: 88 },
          { titulo: "Processo", largura: 70 },
          { titulo: "Operador", largura: 90 },
          { titulo: "Máquina", largura: 60 },
          { titulo: "Boas", largura: 53, alinhar: "right" },
          { titulo: "Refugo", largura: 53, alinhar: "right" },
          { titulo: "Tempo", largura: larguraTabela - 726, alinhar: "right" },
        ],
        linhas: apontamentos.map((item) => [
          dataHora(item.dataHora),
          String(item.op.numeroSequencia),
          item.peca ? `${item.peca.codigo} - ${item.peca.nome}` : "Produto principal",
          item.setor.nome,
          item.processo ? processoLabel(item.processo) : "Produção",
          item.usuario,
          item.maquina?.codigo ?? "-",
          numero(item.quantidadeBoa),
          numero(item.quantidadeRefugo),
          duracao(item.tempoSegundos ?? 0),
        ]),
      },
    ],
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ficha-engate-${nomeArquivo(modelo.codigo)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
