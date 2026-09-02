import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { rotuloMaquina } from "@/lib/maquinas";

export const runtime = "nodejs";

function texto(valor: string | null | undefined) {
  return String(valor ?? "-")
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...");
}

function numero(valor: number | null | undefined) {
  return valor === null || valor === undefined ? "-" : valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function quantidade(valor: number) {
  return valor.toLocaleString("pt-BR");
}

function tempo(segundos: number | null | undefined) {
  if (segundos === null || segundos === undefined) return "-";
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = segundos % 60;
  return [horas, minutos, resto].map((item) => String(item).padStart(2, "0")).join(":");
}

function dataHora(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await buscarOperadorLogado())) return new Response("Não autorizado", { status: 401 });

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) notFound();

  const nest = await prisma.nestCorte.findUnique({
    where: { id },
    include: {
      setor: { select: { nome: true } },
      maquina: { select: { codigo: true, nome: true } },
      programador: { select: { nome: true } },
      itens: {
        include: {
          peca: { select: { codigo: true, nome: true, medida: true } },
          op: { select: { id: true, lote: true, modelo: { select: { codigo: true } } } },
          lancamentos: { select: { quantidadeBoa: true, quantidadeRefugo: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!nest) notFound();

  const requestHeaders = await headers();
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const requestOrigin = forwardedHost
    ? `${forwardedProto ?? (forwardedHost.startsWith("localhost") ? "http" : "https")}://${forwardedHost}`
    : "http://localhost:3000";
  const appOrigin = configuredOrigin || requestOrigin;
  const apontamentoUrl = `${appOrigin}/plasma/${nest.id}?origem=qrcode`;
  const qrDataUrl = await QRCode.toDataURL(apontamentoUrl, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 520,
    color: { dark: "#0f1d34", light: "#ffffff" },
  });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const larguraPagina = 210;
  const margem = 14;
  const larguraConteudo = larguraPagina - margem * 2;
  let y = 60;

  function fonte(tamanho: number, negrito = false, cor: [number, number, number] = [31, 41, 55]) {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(tamanho);
    doc.setTextColor(...cor);
  }

  function escrever(valor: string, x: number, topo: number, tamanho = 9, negrito = false, cor: [number, number, number] = [31, 41, 55]) {
    fonte(tamanho, negrito, cor);
    doc.text(texto(valor), x, topo);
  }

  function quebrar(valor: string, largura: number, tamanho = 8) {
    fonte(tamanho);
    return doc.splitTextToSize(texto(valor), largura) as string[];
  }

  function rodape() {
    const pagina = doc.getNumberOfPages();
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margem, 284, larguraPagina - margem, 284);
    escrever(`ENGATES BRUCKE - Ordem de corte ${nest.codigo}`, margem, 290, 7, false, [100, 116, 139]);
    escrever(`Página ${pagina}`, larguraPagina - margem - 20, 290, 7, false, [100, 116, 139]);
  }

  function novaPagina() {
    rodape();
    doc.addPage();
    y = 18;
    escrever(`ORDEM DE CORTE - ${nest.codigo}`, margem, y, 13, true, [15, 29, 52]);
    escrever("Continuação das peças e informações de produção", margem, y + 7, 8, false, [100, 116, 139]);
    y += 18;
  }

  function garantir(altura: number) {
    if (y + altura > 276) novaPagina();
  }

  function tituloSecao(titulo: string) {
    garantir(12);
    escrever(titulo, margem, y, 11, true, [15, 29, 52]);
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.8);
    doc.line(margem, y + 3, margem + 32, y + 3);
    y += 10;
  }

  function infoGrid(informacoes: Array<[string, string]>) {
    const colunas = 4;
    const gap = 3;
    const largura = (larguraConteudo - gap * (colunas - 1)) / colunas;
    for (let indice = 0; indice < informacoes.length; indice += colunas) {
      garantir(17);
      const linha = informacoes.slice(indice, indice + colunas);
      linha.forEach(([rotulo, valor], coluna) => {
        const x = margem + coluna * (largura + gap);
        doc.setFillColor(245, 247, 251);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, largura, 15, 1.5, 1.5, "FD");
        escrever(rotulo.toUpperCase(), x + 3, y + 5, 6.5, true, [100, 116, 139]);
        escrever(valor, x + 3, y + 11, 8.5, true, [31, 41, 55]);
      });
      y += 18;
    }
  }

  function cabecalhoTabela() {
    doc.setFillColor(15, 29, 52);
    doc.rect(margem, y, larguraConteudo, 9, "F");
    escrever("PEÇA / DESCRIÇÃO", margem + 3, y + 6, 7, true, [255, 255, 255]);
    escrever("OP", margem + 92, y + 6, 7, true, [255, 255, 255, 255]);
    escrever("PLANO", margem + 125, y + 6, 7, true, [255, 255, 255]);
    escrever("CORTADA", margem + 143, y + 6, 7, true, [255, 255, 255]);
    escrever("PERDA", margem + 163, y + 6, 7, true, [255, 255, 255]);
    escrever("PENDENTE", margem + 178, y + 6, 7, true, [255, 255, 255]);
    y += 9;
  }

  doc.setProperties({ title: `Ordem de corte ${nest.codigo}`, subject: "Informações para corte do NEST" });
  doc.setFillColor(15, 29, 52);
  doc.rect(0, 0, larguraPagina, 50, "F");
  escrever("ENGATES BRUCKE", margem, 15, 9, true, [125, 211, 252]);
  escrever("ORDEM DE CORTE", margem, 27, 16, true, [255, 255, 255]);
  escrever(nest.codigo, margem, 41, 14, true, [255, 255, 255]);
  escrever(`${nest.setor.nome} - ${rotuloMaquina(nest.maquina.codigo, nest.maquina.nome)}`, margem + 50, 40, 8.5, false, [191, 219, 254]);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(161, 7, 35, 35, 2, 2, "F");
  doc.addImage(qrDataUrl, "PNG", 163, 9, 31, 31);
  escrever("ESCANEIE PARA APONTAR", 156, 47, 6.5, true, [15, 29, 52]);

  tituloSecao("Dados do corte");
  infoGrid([
    ["Situação", nest.status],
    ["Máquina", rotuloMaquina(nest.maquina.codigo, nest.maquina.nome)],
    ["Setor", nest.setor.nome],
    ["Material", nest.material],
    ["Espessura", nest.espessuraMm === null ? "-" : `${numero(nest.espessuraMm)} mm`],
    ["Chapa", nest.larguraChapaMm === null || nest.alturaChapaMm === null ? "-" : `${numero(nest.larguraChapaMm)} x ${numero(nest.alturaChapaMm)} mm`],
    ["Chapas", quantidade(nest.quantidadeChapas)],
    ["Programado por", nest.programador.nome],
  ]);

  tituloSecao("Peças para cortar");
  garantir(9);
  cabecalhoTabela();
  nest.itens.forEach((item, indice) => {
    const boas = item.lancamentos.reduce((total, lancamento) => total + lancamento.quantidadeBoa, 0);
    const perdas = item.lancamentos.reduce((total, lancamento) => total + lancamento.quantidadeRefugo, 0);
    const pendente = Math.max(0, item.quantidadePlanejada - boas);
    const descricao = `${item.peca.codigo} - ${item.peca.nome}${item.peca.medida ? ` (${item.peca.medida})` : ""}`;
    const descricaoLinhas = quebrar(descricao, 73, 8);
    const altura = Math.max(13, 7 + (descricaoLinhas.length - 1) * 4);
    if (y + altura > 276) {
      novaPagina();
      cabecalhoTabela();
    }
    if (indice % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margem, y, larguraConteudo, altura, "F");
    }
    descricaoLinhas.forEach((linha, linhaIndice) => escrever(linha, margem + 3, y + 6 + linhaIndice * 4, 8, linhaIndice === 0, [31, 41, 55]));
    escrever(`OP ${item.op.lote ?? `#${item.op.id}`} / ${item.op.modelo.codigo}`, margem + 92, y + 6, 7.5, false, [71, 85, 105]);
    escrever(quantidade(item.quantidadePlanejada), margem + 128, y + 6, 8, true, [31, 41, 55]);
    escrever(quantidade(boas), margem + 147, y + 6, 8, true, [5, 150, 105]);
    escrever(quantidade(perdas), margem + 166, y + 6, 8, true, [225, 29, 72]);
    escrever(quantidade(pendente), margem + 182, y + 6, 8, true, [180, 83, 9]);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margem, y + altura, margem + larguraConteudo, y + altura);
    y += altura;
  });

  y += 7;
  tituloSecao("Parâmetros e observações");
  infoGrid([
    ["Arquivo / referência", nest.nomeArquivo],
    ["Tempo de corte", tempo(nest.tempoCorteSegundos)],
    ["Movimento rápido", nest.comprimentoRapidoMm === null ? "-" : `${numero(nest.comprimentoRapidoMm)} mm`],
    ["Aproveitamento", nest.aproveitamentoPct === null ? "-" : `${numero(nest.aproveitamentoPct)}%`],
    ["Perfurações", numero(nest.numeroPiercings)],
    ["Comprimento de corte", nest.comprimentoCorteMm === null ? "-" : `${numero(nest.comprimentoCorteMm)} mm`],
    ["Peso da chapa", nest.pesoChapaKg === null ? "-" : `${numero(nest.pesoChapaKg)} kg`],
    ["Gerado em", dataHora(nest.createdAt)],
  ]);
  if (nest.observacao) {
    garantir(18);
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(margem, y, larguraConteudo, 15, 1.5, 1.5, "FD");
    escrever("OBSERVAÇÃO", margem + 3, y + 5, 6.5, true, [146, 64, 14]);
    const observacaoLinhas = quebrar(nest.observacao, larguraConteudo - 6, 8);
    observacaoLinhas.slice(0, 2).forEach((linha, indice) => escrever(linha, margem + 3, y + 10 + indice * 4, 8, false, [120, 53, 15]));
    y += 18;
  }

  rodape();
  const pdf = doc.output("arraybuffer");
  const nomeArquivo = nest.codigo.replace(/[^a-zA-Z0-9_-]/g, "-");
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ordem-corte-${nomeArquivo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
