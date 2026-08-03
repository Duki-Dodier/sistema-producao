import { formatDate } from "@/lib/format";
import { gerarPdfRelatorio } from "@/lib/pdf-relatorio";
import { periodoRelatorio, relatorioGeralSolda } from "@/lib/solda-relatorios";
import { buscarOperadorLogado } from "@/lib/auth-operador";

export const runtime = "nodejs";

const numero = (valor: number, casas = 0) => valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export async function GET(request: Request) {
  if (!(await buscarOperadorLogado())) return new Response("Nao autorizado", { status: 401 });
  const url = new URL(request.url);
  const periodo = periodoRelatorio(url.searchParams.get("inicio") ?? undefined, url.searchParams.get("fim") ?? undefined);
  const dados = await relatorioGeralSolda(periodo);
  const pdf = gerarPdfRelatorio({
    titulo: "Relatório Geral da Solda",
    subtitulo: "Produtividade do setor, ranking, mix produzido e fila atual",
    periodo: `${formatDate(periodo.inicio)} a ${formatDate(periodo.fim)}`,
    kpis: [
      { label: "Peças soldadas", value: numero(dados.totalSoldado) },
      { label: "Média por dia", value: numero(dados.mediaDia, 1) },
      { label: "Dias com produção", value: String(dados.diasTrabalhados) },
      { label: "Soldadores ativos", value: String(dados.soldadoresAtivos) },
      { label: "OPs atendidas", value: String(dados.opsAtendidas) },
      { label: "Melhor dia", value: dados.melhorDia ? `${dados.melhorDia.label} - ${dados.melhorDia.quantidade}` : "-" },
      { label: "Pior dia trabalhado", value: dados.piorDia ? `${dados.piorDia.label} - ${dados.piorDia.quantidade}` : "-" },
      { label: "Aguardando solda", value: numero(dados.aguardandoSolda) },
    ],
    secoes: [
      {
        titulo: "Produção total por dia",
        colunas: [{ titulo: "Dia", largura: 260 }, { titulo: "Peças soldadas", largura: 259, alinhar: "right" }],
        linhas: dados.dias.map((item) => [item.label, String(item.quantidade)]),
      },
      {
        titulo: "Ranking de soldadores",
        colunas: [
          { titulo: "Pos.", largura: 35 }, { titulo: "Soldador", largura: 100 }, { titulo: "Peças", largura: 55, alinhar: "right" },
          { titulo: "Dias", largura: 45, alinhar: "right" }, { titulo: "Média", largura: 55, alinhar: "right" },
          { titulo: "OPs", largura: 45, alinhar: "right" }, { titulo: "Código principal", largura: 100 },
          { titulo: "Qtd.", largura: 84, alinhar: "right" },
        ],
        linhas: dados.ranking.map((item, indice) => [`${indice + 1}`, item.soldador, String(item.soldadas), String(item.dias), numero(item.media, 1), String(item.ops), item.codigoPrincipal, String(item.quantidadePrincipal)]),
      },
      {
        titulo: "Códigos soldados",
        colunas: [
          { titulo: "Código", largura: 80 }, { titulo: "Descrição", largura: 180 }, { titulo: "Soldadas", largura: 65, alinhar: "right" },
          { titulo: "Participação", largura: 65, alinhar: "right" }, { titulo: "OPs", largura: 50, alinhar: "right" },
          { titulo: "Soldadores", largura: 79, alinhar: "right" },
        ],
        linhas: dados.codigos.map((item) => [item.codigo, item.nome ?? "-", String(item.soldadas), dados.totalSoldado ? `${Math.round(item.soldadas / dados.totalSoldado * 100)}%` : "0%", String(item.ops), String(item.soldadores)]),
      },
      {
        titulo: `Fila atual - ${dados.aguardandoSolda} peças aguardando solda`,
        colunas: [
          { titulo: "OP", largura: 45 }, { titulo: "Código", largura: 75 }, { titulo: "Descrição", largura: 179 },
          { titulo: "Recebidas", largura: 65, alinhar: "right" }, { titulo: "Soldadas", largura: 65, alinhar: "right" },
          { titulo: "Aguardando", largura: 90, alinhar: "right" },
        ],
        linhas: dados.aguardandoPorOp.map((item) => [String(item.numero), item.codigo, item.nome ?? "-", String(item.recebido), String(item.soldado), String(item.aguardando)]),
      },
    ],
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=relatorio-geral-solda.pdf",
      "Cache-Control": "no-store",
    },
  });
}
