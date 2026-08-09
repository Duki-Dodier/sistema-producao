import { buscarOperadorLogado } from "@/lib/auth-operador";
import { gerarPdfRelatorio } from "@/lib/pdf-relatorio";
import { calcularProgressoOPs } from "@/lib/pcp";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

export const runtime = "nodejs";

const numero = (valor: number) => valor.toLocaleString("pt-BR");

export async function GET(request: Request) {
  if (!(await buscarOperadorLogado())) {
    return new Response("Não autorizado", { status: 401 });
  }

  const url = new URL(request.url);
  const busca = (url.searchParams.get("busca") ?? "").trim().toLowerCase();
  const [ops, setores] = await Promise.all([
    prisma.oP.findMany({
      where: { status: "ABERTA" },
      include: {
        modelo: {
          include: {
            roteiro: { include: { setor: true }, orderBy: { ordem: "asc" } },
            pecas: {
              include: {
                peca: {
                  include: {
                    roteiro: { include: { setor: true }, orderBy: { ordem: "asc" } },
                  },
                },
              },
            },
          },
        },
        apontamentos: true,
      },
    }),
    prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } }),
  ]);

  let progresso = calcularProgressoOPs(ops).sort(
    (a, b) => a.op.numeroSequencia - b.op.numeroSequencia,
  );
  if (busca) {
    progresso = progresso.filter((item) =>
      `${item.op.numeroSequencia} ${item.op.lote ?? ""} ${item.op.modelo.codigo}`
        .toLowerCase()
        .includes(busca),
    );
  }

  const soldaId = setores.find((setor) => ehSetor(setor.nome, "Solda"))?.id;
  const enviadoParaSolda = (item: (typeof progresso)[number]) =>
    soldaId === undefined
      ? 0
      : item.op.apontamentos
          .filter((apontamento) => apontamento.setorId === soldaId && apontamento.soldador !== null)
          .reduce((total, apontamento) => total + apontamento.quantidadeBoa, 0);

  const totalQuantidade = progresso.reduce((total, item) => total + item.op.quantidade, 0);
  const totalEnviado = progresso.reduce((total, item) => total + enviadoParaSolda(item), 0);
  const opsProntas = progresso.filter((item) => item.prontoParaSolda).length;
  const opsNaSolda = progresso.filter((item) => {
    const solda = item.setores.find((setor) => ehSetor(setor.setorNome, "Solda"));
    return Boolean(
      solda &&
        !solda.completo &&
        (item.setorAtual?.setorId === solda.setorId || enviadoParaSolda(item) > 0),
    );
  }).length;

  const pdf = gerarPdfRelatorio({
    titulo: "Relatório do Agrupamento",
    subtitulo: "Sequenciamento e situação das ordens abertas",
    periodo: `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    orientacao: "paisagem",
    kpis: [
      { label: "OPs abertas", value: String(progresso.length) },
      { label: "Peças nas OPs", value: numero(totalQuantidade) },
      { label: "Prontas para Solda", value: String(opsProntas) },
      { label: "OPs na Solda", value: String(opsNaSolda) },
      { label: "Peças enviadas à Solda", value: numero(totalEnviado) },
    ],
    secoes: [
      {
        titulo: "Posição atual das ordens",
        colunas: [
          { titulo: "Seq.", largura: 42, alinhar: "right" },
          { titulo: "SKU", largura: 98 },
          { titulo: "Lote", largura: 62 },
          { titulo: "Qtd. OP", largura: 48, alinhar: "right" },
          { titulo: "Setor atual", largura: 128 },
          { titulo: "Progresso", largura: 62, alinhar: "right" },
          { titulo: "Pré-pronto", largura: 72 },
          { titulo: "Envio Solda", largura: 72, alinhar: "right" },
          { titulo: "Saldo", largura: 58, alinhar: "right" },
          { titulo: "Situação", largura: 110 },
        ],
        linhas: progresso.map((item) => {
          const enviado = enviadoParaSolda(item);
          return [
            String(item.op.numeroSequencia),
            item.op.modelo.codigo,
            item.op.lote ?? "-",
            numero(item.op.quantidade),
            item.setorAtual?.setorNome.toLocaleUpperCase("pt-BR") ?? "CONCLUÍDA",
            `${item.percentual}%`,
            item.prontoParaSolda ? "COMPLETO" : "PENDENTE",
            numero(enviado),
            numero(Math.max(item.op.quantidade - enviado, 0)),
            item.completo ? "FINALIZADA" : "EM PRODUÇÃO",
          ];
        }),
      },
    ],
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="relatorio-agrupamento.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
