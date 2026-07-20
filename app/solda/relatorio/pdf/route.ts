import { formatDate } from "@/lib/format";
import { gerarPdfRelatorio } from "@/lib/pdf-relatorio";
import { periodoRelatorio, relatorioDoSoldador } from "@/lib/solda-relatorios";

export const runtime = "nodejs";

const numero = (valor: number, casas = 0) => valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const soldador = (url.searchParams.get("soldador") ?? "").trim();
  if (!soldador) return new Response("Informe o soldador.", { status: 400 });
  const periodo = periodoRelatorio(url.searchParams.get("inicio") ?? undefined, url.searchParams.get("fim") ?? undefined);
  const dados = await relatorioDoSoldador(soldador, periodo);
  const pdf = gerarPdfRelatorio({
    titulo: `Relatório do Soldador - ${soldador}`,
    subtitulo: "Produção, produtividade, códigos e ordens de produção atendidas",
    periodo: `${formatDate(periodo.inicio)} a ${formatDate(periodo.fim)}`,
    kpis: [
      { label: "Peças soldadas", value: numero(dados.totalSoldado) },
      { label: "Peças recebidas", value: numero(dados.totalRecebido) },
      { label: "Dias trabalhados", value: String(dados.diasTrabalhados) },
      { label: "Média por dia", value: numero(dados.mediaDia, 1) },
      { label: "OPs atendidas", value: String(dados.opsAtendidas) },
      { label: "Melhor dia", value: dados.melhorDia ? `${dados.melhorDia.label} - ${dados.melhorDia.quantidade}` : "-" },
      { label: "Pior dia trabalhado", value: dados.piorDia ? `${dados.piorDia.label} - ${dados.piorDia.quantidade}` : "-" },
      { label: "Código líder", value: dados.codigoMaisSoldado?.codigo ?? "-" },
    ],
    secoes: [
      {
        titulo: "Produção diária",
        colunas: [{ titulo: "Dia", largura: 260 }, { titulo: "Peças soldadas", largura: 259, alinhar: "right" }],
        linhas: dados.dias.map((item) => [item.label, String(item.quantidade)]),
      },
      {
        titulo: "Códigos soldados no período",
        colunas: [
          { titulo: "Código", largura: 75 }, { titulo: "Descrição", largura: 144 },
          { titulo: "Soldadas", largura: 55, alinhar: "right" }, { titulo: "Recebidas", largura: 55, alinhar: "right" },
          { titulo: "Saldo", largura: 50, alinhar: "right" }, { titulo: "OPs", largura: 50, alinhar: "right" },
          { titulo: "Conclusão", largura: 90, alinhar: "right" },
        ],
        linhas: dados.codigos.map((item) => [item.codigo, item.nome ?? "-", String(item.soldadas), String(item.recebidas), String(item.saldo), String(item.ops), `${item.percentual}%`]),
      },
      {
        titulo: "Ordens de produção atendidas",
        colunas: [
          { titulo: "OP", largura: 45 }, { titulo: "Código", largura: 70 }, { titulo: "Descrição", largura: 154 },
          { titulo: "Soldadas", largura: 55, alinhar: "right" }, { titulo: "Dias", largura: 45, alinhar: "right" },
          { titulo: "Primeiro", largura: 75 }, { titulo: "Último", largura: 75 },
        ],
        linhas: dados.ops.map((item) => [String(item.numero), item.codigo, item.nome ?? "-", String(item.soldadas), String(item.dias), formatDate(item.primeiro), formatDate(item.ultimo)]),
      },
    ],
  });
  const nome = soldador.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-soldador-${nome}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
