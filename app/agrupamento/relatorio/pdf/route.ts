import { buscarOperadorLogado } from "@/lib/auth-operador";
import { gerarPdfRelatorio } from "@/lib/pdf-relatorio";
import { calcularProgressoOPs } from "@/lib/pcp";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

export const runtime = "nodejs";

const numero = (valor: number) => valor.toLocaleString("pt-BR");
const data = (valor: Date) => valor.toLocaleDateString("pt-BR");
const hora = (valor: Date) => valor.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const nomeSetor = (valor: string) => valor.toLocaleUpperCase("pt-BR");

export async function GET(request: Request) {
  if (!(await buscarOperadorLogado())) {
    return new Response("Não autorizado", { status: 401 });
  }

  const url = new URL(request.url);
  const busca = (url.searchParams.get("busca") ?? "").trim().toLowerCase();
  const filtroParam = (url.searchParams.get("falta") ?? "").trim();
  const filtroIdParam = /^\d+$/.test(filtroParam) ? Number(filtroParam) : null;

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

  const filtroSetor = filtroIdParam === null
    ? null
    : setores.find((setor) => setor.id === filtroIdParam) ?? null;
  if (filtroSetor) {
    progresso = progresso.filter((item) =>
      item.setores.some((setor) => setor.setorId === filtroSetor.id && !setor.completo),
    );
  }

  const soldaId = setores.find((setor) => ehSetor(setor.nome, "Solda"))?.id;
  const enviadoParaSolda = (item: (typeof progresso)[number]) =>
    soldaId === undefined
      ? 0
      : item.op.apontamentos
          .filter((apontamento) => apontamento.setorId === soldaId && apontamento.soldador !== null)
          .reduce((total, apontamento) => total + apontamento.quantidadeBoa, 0);

  const enviosSolda = progresso
    .flatMap((item) =>
      item.op.apontamentos
        .filter((apontamento) => apontamento.setorId === soldaId && apontamento.soldador !== null)
        .map((apontamento) => ({ item, apontamento })),
    )
    .sort((a, b) => b.apontamento.dataHora.getTime() - a.apontamento.dataHora.getTime());

  const pendencias = progresso.flatMap((item) =>
    item.setores
      .filter((setor) => !setor.completo && !ehSetor(setor.setorNome, "Agrupamento"))
      .filter((setor) => !filtroSetor || setor.setorId === filtroSetor.id)
      .flatMap((setor) => {
        if (setor.pecas.length > 0) {
          return setor.pecas
            .filter((peca) => peca.falta > 0)
            .map((peca) => ({
              numero: item.op.numeroSequencia,
              sku: item.op.modelo.codigo,
              lote: item.op.lote ?? "-",
              setor: nomeSetor(setor.setorNome),
              peca: `${peca.codigo} - ${peca.nome}`,
              necessaria: peca.necessaria,
              produzida: peca.produzida,
              falta: peca.falta,
            }));
        }
        return [{
          numero: item.op.numeroSequencia,
          sku: item.op.modelo.codigo,
          lote: item.op.lote ?? "-",
          setor: nomeSetor(setor.setorNome),
          peca: "TOTAL DO SETOR",
          necessaria: item.op.quantidade,
          produzida: setor.quantidadeBoa,
          falta: setor.falta,
        }];
      }),
  );

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

  const filtroTexto = filtroSetor ? `Pendências: ${nomeSetor(filtroSetor.nome)}` : "Pendências: todos os setores";
  const pdf = gerarPdfRelatorio({
    titulo: "Relatório do Agrupamento",
    subtitulo: `Envios para Solda e pendências de produção · ${filtroTexto}`,
    periodo: `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    orientacao: "paisagem",
    kpis: [
      { label: "OPs abertas", value: String(progresso.length) },
      { label: "Peças nas OPs", value: numero(totalQuantidade) },
      { label: "Prontas para Solda", value: String(opsProntas) },
      { label: "OPs na Solda", value: String(opsNaSolda) },
      { label: "Peças enviadas à Solda", value: numero(totalEnviado) },
      { label: "Linhas pendentes", value: numero(pendencias.length) },
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
      {
        titulo: "OPs enviadas para Solda",
        colunas: [
          { titulo: "Data", largura: 58 },
          { titulo: "Hora", largura: 42 },
          { titulo: "Nº OP", largura: 42, alinhar: "right" },
          { titulo: "Lote", largura: 58 },
          { titulo: "SKU", largura: 88 },
          { titulo: "Soldador", largura: 112 },
          { titulo: "Bancada / Box", largura: 92 },
          { titulo: "Abastecedor", largura: 110 },
          { titulo: "Quantidade", largura: 64, alinhar: "right" },
        ],
        linhas: enviosSolda.map(({ item, apontamento }) => [
          data(apontamento.dataHora),
          hora(apontamento.dataHora),
          String(item.op.numeroSequencia),
          item.op.lote ?? "-",
          item.op.modelo.codigo,
          apontamento.soldador ?? "-",
          apontamento.bancada ?? "-",
          apontamento.abastecedor ?? "-",
          numero(apontamento.quantidadeBoa),
        ]),
      },
      {
        paginaNovaAntes: true,
        titulo: `Pendências para completar as OPs · ${filtroTexto}`,
        colunas: [
          { titulo: "Seq.", largura: 42, alinhar: "right" },
          { titulo: "SKU", largura: 86 },
          { titulo: "Lote", largura: 58 },
          { titulo: "Setor", largura: 125 },
          { titulo: "Peça / Item", largura: 145 },
          { titulo: "Necessária", largura: 68, alinhar: "right" },
          { titulo: "Produzida", largura: 68, alinhar: "right" },
          { titulo: "Falta", largura: 62, alinhar: "right" },
        ],
        linhas: pendencias.map((item) => [
          String(item.numero),
          item.sku,
          item.lote,
          item.setor,
          item.peca,
          numero(item.necessaria),
          numero(item.produzida),
          numero(item.falta),
        ]),
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
