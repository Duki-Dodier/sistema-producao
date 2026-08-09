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

  const pdf = setorId === null
    ? gerarPdfRelatorio({
        titulo: "Relatorio de Producao Geral",
        subtitulo: "Saida final por setor e ordens de producao apontadas",
        periodo: dados.periodo.mesLabel,
        kpis: [
          { label: "Itens finalizados", value: numero(dados.total) },
          { label: "Dias com producao", value: String(dados.diasComProducao) },
          {
            label: "Setores com producao",
            value: String(dados.setoresRelatorio.filter((item) => item.total > 0).length),
          },
          { label: "Media por dia", value: numero(mediaDia, 1) },
        ],
        secoes: [
          {
            titulo: "Producao diaria geral",
            colunas: [
              { titulo: "Data", largura: 260 },
              { titulo: "Itens finalizados", largura: 259, alinhar: "right" },
            ],
            linhas: producaoDiaria.map((item) => [item.label, numero(item.total)]),
          },
          {
            titulo: "Total por setor",
            colunas: [
              { titulo: "Setor", largura: 300 },
              { titulo: "Producao", largura: 100, alinhar: "right" },
              { titulo: "Participacao", largura: 119, alinhar: "right" },
            ],
            linhas: dados.setoresRelatorio.map((item) => [
              nomeSetorRelatorio(item.nome),
              numero(item.total),
              percentual(item.total, dados.total),
            ]),
          },
          {
            titulo: "Ordens apontadas",
            colunas: [
              { titulo: "OP", largura: 42 },
              { titulo: "Lote", largura: 78 },
              { titulo: "Codigo", largura: 88 },
              { titulo: "Setor", largura: 145 },
              { titulo: "Qtd. OP", largura: 58, alinhar: "right" },
              { titulo: "Produzido", largura: 58, alinhar: "right" },
              { titulo: "Saldo", largura: 50, alinhar: "right" },
            ],
            linhas: dados.ordens.map((item) => [
              String(item.numero),
              item.lote ?? "-",
              item.codigo,
              nomeSetorRelatorio(item.setor),
              numero(item.quantidade),
              numero(item.produzido),
              numero(Math.max(item.quantidade - item.produzido, 0)),
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
