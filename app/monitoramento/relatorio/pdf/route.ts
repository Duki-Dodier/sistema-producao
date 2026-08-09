import { buscarOperadorLogado } from "@/lib/auth-operador";
import { gerarPdfRelatorio } from "@/lib/pdf-relatorio";
import {
  idSetorPorParametro,
  nomeSetorRelatorio,
  relatorioProducaoSetor,
} from "@/lib/relatorio-producao-setor";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const numero = (valor: number, casas = 0) =>
  valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

const percentual = (valor: number, total: number) =>
  total > 0 ? `${Math.round((valor / total) * 100)}%` : "0%";

function rotuloSetorCompacto(nome: string) {
  const chave = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (chave.includes("BARRA CHATA") || chave.includes("CANTONEIRA")) return "BARRA/CANT.";
  if (chave.includes("REFOR")) return "REFORCO";
  if (chave.includes("PLASMA CHAPA")) return "PLASMA CH.";
  if (chave.includes("PLASMA TUBO")) return "PLASMA TUB.";
  if (chave.includes("ACESS")) return "ACESS.";
  if (chave.includes("AGRUP")) return "AGRUP.";
  return chave;
}

function nomeArquivo(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function GET(request: Request) {
  if (!(await buscarOperadorLogado())) {
    return new Response("Nao autorizado", { status: 401 });
  }

  const url = new URL(request.url);
  const setorParametro = (url.searchParams.get("setor") ?? "geral").trim();
  const setores = await prisma.setor.findMany({
    orderBy: { ordemPadrao: "asc" },
    select: { id: true, nome: true },
  });
  const setorId = idSetorPorParametro(setorParametro, setores);

  if (setorParametro !== "geral" && setorId === null) {
    return new Response("Setor invalido.", { status: 400 });
  }

  const dados = await relatorioProducaoSetor(
    setorId,
    url.searchParams.get("mes") ?? undefined,
  );
  const relatorioSetor = dados.setor;
  const tituloSetor = nomeSetorRelatorio(relatorioSetor?.nome);
  const producaoDiaria = dados.producaoDiaria.filter((item) => item.total > 0);
  const mediaDia = dados.diasComProducao > 0
    ? dados.total / dados.diasComProducao
    : 0;
  const mediaParaMeta = dados.metaTotal && dados.diasUteis > 0
    ? dados.metaTotal / dados.diasUteis
    : null;
  const valorGrade = (valor: number) => valor > 0 ? numero(valor) : "-";
  const larguraTabelaGeral = 842 - 38 * 2;
  const larguraDataGeral = 54;
  const larguraTotalGeral = 62;
  const larguraSetorGeral =
    (larguraTabelaGeral - larguraDataGeral - larguraTotalGeral) /
    Math.max(dados.setores.length, 1);
  const linhasGradeGeral = [
    ...dados.producaoDiariaSetores.map((item) => [
      item.label,
      ...item.valores.map(valorGrade),
      valorGrade(item.total),
    ]),
    [
      "TOTAL DO MES",
      ...dados.setoresRelatorio.map((item) => valorGrade(item.total)),
      valorGrade(dados.total),
    ],
  ];

  const pdf = setorId === null
    ? gerarPdfRelatorio({
        titulo: "Relatorio de Producao Geral",
        subtitulo: "Saida final diaria por setor",
        periodo: dados.periodo.mesLabel,
        orientacao: "paisagem",
        kpis: [
          { label: "Total produzido", value: numero(dados.total) },
          { label: "Meta geral", value: dados.metaTotal ? numero(dados.metaTotal) : "-" },
          {
            label: "Media p/ meta por dia",
            value: mediaParaMeta === null ? "-" : numero(mediaParaMeta, 1),
          },
          { label: "Media dos lancamentos/dia", value: numero(mediaDia, 1) },
          { label: "Lancamentos", value: numero(dados.quantidadeLancamentos) },
          { label: "Media por lancamento", value: numero(dados.mediaPorLancamento, 1) },
          { label: "Dias com producao", value: String(dados.diasComProducao) },
          {
            label: "Setores com producao",
            value: String(dados.setoresRelatorio.filter((item) => item.total > 0).length),
          },
        ],
        secoes: [
          {
            titulo: "Producao diaria geral",
            colunas: [
              { titulo: "Data", largura: larguraDataGeral },
              ...dados.setores.map((setor) => ({
                titulo: rotuloSetorCompacto(setor.nome),
                largura: larguraSetorGeral,
                alinhar: "right" as const,
              })),
              { titulo: "Total", largura: larguraTotalGeral, alinhar: "right" as const },
            ],
            linhas: linhasGradeGeral,
          },
          {
            titulo: "Media por setor",
            colunas: [
              { titulo: "Setor", largura: 205 },
              { titulo: "Total lancado", largura: 95, alinhar: "right" },
              { titulo: "Dias", largura: 70, alinhar: "right" },
              { titulo: "Media lancamentos", largura: 130, alinhar: "right" },
              { titulo: "Media cadastrada", largura: 130, alinhar: "right" },
              { titulo: "Situacao", largura: 136 },
            ],
            linhas: dados.setoresRelatorio.map((item) => [
              nomeSetorRelatorio(item.nome),
              numero(item.total),
              String(item.diasComProducao),
              numero(item.mediaLancamentos, 1),
              item.mediaMeta === null ? "-" : numero(item.mediaMeta, 1),
              item.situacao,
            ]),
          },
        ],
      })
    : gerarPdfRelatorio({
        titulo: `Relatorio de Producao - ${tituloSetor}`,
        subtitulo: "Producao final por operador e ordens apontadas",
        periodo: dados.periodo.mesLabel,
        kpis: [
          { label: "Producao do setor", value: numero(dados.total) },
          { label: "Dias com producao", value: String(dados.diasComProducao) },
          {
            label: "Operadores com producao",
            value: String(dados.resumoOperadores.filter((item) => item.total > 0).length),
          },
          { label: "Media por dia", value: numero(mediaDia, 1) },
        ],
        secoes: [
          {
            titulo: "Producao diaria",
            colunas: [
              { titulo: "Data", largura: 260 },
              { titulo: "Producao", largura: 259, alinhar: "right" },
            ],
            linhas: producaoDiaria.map((item) => [item.label, numero(item.total)]),
          },
          {
            titulo: "Resumo por operador",
            colunas: [
              { titulo: "Operador", largura: 210 },
              { titulo: "Pecas", largura: 82, alinhar: "right" },
              { titulo: "Dias", largura: 62, alinhar: "right" },
              { titulo: "Media/dia", largura: 85, alinhar: "right" },
              { titulo: "Participacao", largura: 80, alinhar: "right" },
            ],
            linhas: dados.resumoOperadores.map((item) => [
              item.nome,
              numero(item.total),
              String(item.diasTrabalhados),
              numero(item.media),
              percentual(item.total, dados.total),
            ]),
          },
          {
            titulo: "Ordens apontadas",
            colunas: [
              { titulo: "OP", largura: 48 },
              { titulo: "Lote", largura: 88 },
              { titulo: "Codigo", largura: 120 },
              { titulo: "Qtd. OP", largura: 82, alinhar: "right" },
              { titulo: "Produzido", largura: 90, alinhar: "right" },
              { titulo: "Saldo", largura: 91, alinhar: "right" },
            ],
            linhas: dados.ordens.map((item) => [
              String(item.numero),
              item.lote ?? "-",
              item.codigo,
              numero(item.quantidade),
              numero(item.produzido),
              numero(Math.max(item.quantidade - item.produzido, 0)),
            ]),
          },
        ],
      });

  const slug = nomeArquivo(setorId === null ? "geral" : tituloSetor);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-producao-${slug || "geral"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
