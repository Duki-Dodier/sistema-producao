import { jsPDF } from "jspdf";

type PlanoPdf = {
  codigo: string;
  emitidoEm: Date;
  comprimentoBarraMm: number;
  perdaCorteMm: number;
  refileInicialMm: number;
  totalOps: number;
  totalPadroes: number;
  totalBarras: number;
  totalPecas: number;
  comprimentoPecasMm: number;
  perdaCortesTotalMm: number;
  sobraTotalMm: number;
  aproveitamentoPct: number;
  criadoPor: { nome: string };
  padroes: Array<{
    codigo: string;
    perfilMm: number;
    espessuraMm: number;
    repeticoes: number;
    comprimentoBarraMm: number;
    comprimentoPecasPorBarraMm: number;
    perdaCortesPorBarraMm: number;
    refileInicialMm: number;
    sobraPorBarraMm: number;
    aproveitamentoPct: number;
    itens: Array<{
      opNumero: number;
      lote: string;
      modeloCodigo: string;
      pecaCodigo: string;
      pecaNome: string;
      quantidadePorBarra: number;
      quantidadeTotal: number;
      comprimentoUnitarioMm: number;
    }>;
  }>;
};

const NAVY: [number, number, number] = [10, 27, 48];
const CYAN: [number, number, number] = [8, 145, 178];
const INK: [number, number, number] = [25, 39, 58];
const MUTED: [number, number, number] = [90, 105, 125];
const LINE: [number, number, number] = [203, 213, 225];
const PALE: [number, number, number] = [244, 247, 250];
const AMBER: [number, number, number] = [202, 138, 4];
const SEGMENTOS: Array<[number, number, number]> = [[34, 211, 238], [56, 189, 248], [52, 211, 153], [251, 191, 36], [167, 139, 250], [251, 113, 133]];

function limpar(valor: unknown) {
  return String(valor ?? "-")
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/·/g, "-");
}

function numero(valor: number, casas = 0) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function gerarPdfPlanoCorteTubos(plano: PlanoPdf, logo?: Uint8Array) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const paginaW = 297;
  const paginaH = 210;
  const margem = 12;
  const largura = paginaW - margem * 2;
  const limiteY = 194;
  let y = 35;

  function fonte(tamanho: number, negrito = false, cor: [number, number, number] = INK) {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(tamanho);
    doc.setTextColor(...cor);
  }

  function texto(valor: unknown, x: number, topo: number, tamanho = 7, negrito = false, cor: [number, number, number] = INK, alinhamento: "left" | "center" | "right" = "left") {
    fonte(tamanho, negrito, cor);
    doc.text(limpar(valor), x, topo, { align: alinhamento });
  }

  function cabecalho(primeira: boolean) {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, paginaW, primeira ? 28 : 20, "F");
    if (logo) {
      const base64 = `data:image/png;base64,${Buffer.from(logo).toString("base64")}`;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margem, 4, 31, primeira ? 20 : 13, 1, 1, "F");
      doc.addImage(base64, "PNG", margem + 2, primeira ? 6 : 5, 27, primeira ? 16 : 11, undefined, "FAST");
    } else {
      texto("BRUCKE", margem, primeira ? 17 : 13, 11, true, [255, 255, 255]);
    }
    texto("PLANO TECNICO DE CORTE - TUBOS", 51, primeira ? 12 : 8.5, 9.5, true, [165, 243, 252]);
    texto(plano.codigo, 51, primeira ? 22 : 15.5, primeira ? 15 : 10.5, true, [255, 255, 255]);
    texto("DOCUMENTO ORIENTATIVO DO PCP", paginaW - margem, primeira ? 12 : 9, 7, true, [253, 230, 138], "right");
    texto(plano.emitidoEm.toLocaleString("pt-BR"), paginaW - margem, primeira ? 21 : 15.5, 6.5, false, [191, 219, 254], "right");
  }

  function novaPagina() {
    doc.addPage();
    cabecalho(false);
    y = 28;
  }

  function garantir(altura: number) {
    if (y + altura > limiteY) novaPagina();
  }

  function secao(titulo: string) {
    garantir(10);
    texto(titulo.toUpperCase(), margem, y + 4, 8, true, NAVY);
    doc.setDrawColor(...CYAN);
    doc.setLineWidth(0.7);
    doc.line(margem, y + 7, margem + 31, y + 7);
    y += 11;
  }

  function indicadores() {
    const itens = [
      ["RESPONSAVEL", plano.criadoPor.nome],
      ["OPS", numero(plano.totalOps)],
      ["PECAS", numero(plano.totalPecas)],
      ["PADROES", numero(plano.totalPadroes)],
      ["BARRAS DE 6 M", numero(plano.totalBarras)],
      ["METROS UTEIS", `${numero(plano.comprimentoPecasMm / 1000, 2)} m`],
      ["PERDA DA SERRA", `${numero(plano.perdaCortesTotalMm / 1000, 2)} m`],
      ["SOBRA PREVISTA", `${numero(plano.sobraTotalMm / 1000, 2)} m`],
      ["APROVEITAMENTO", `${numero(plano.aproveitamentoPct, 1)}%`],
      ["SERRA / REFILE", `${numero(plano.perdaCorteMm, 1)} / ${numero(plano.refileInicialMm, 1)} mm`],
    ];
    const gap = 2;
    const colW = (largura - gap * 4) / 5;
    itens.forEach(([rotulo, valor], indice) => {
      const linha = Math.floor(indice / 5);
      const coluna = indice % 5;
      const x = margem + coluna * (colW + gap);
      const topo = y + linha * 14;
      doc.setFillColor(...PALE);
      doc.setDrawColor(...LINE);
      doc.roundedRect(x, topo, colW, 11.5, 1, 1, "FD");
      texto(rotulo, x + 2.5, topo + 4, 5.3, true, MUTED);
      texto(valor, x + 2.5, topo + 8.8, 7.2, true, INK);
    });
    y += 31;
  }

  function listaOps() {
    const ops = [...new Map(plano.padroes.flatMap((padrao) => padrao.itens).map((item) => [`${item.opNumero}:${item.lote}`, item])).values()]
      .sort((a, b) => a.opNumero - b.opNumero || a.lote.localeCompare(b.lote, "pt-BR"));
    const textoOps = ops.map((item) => `OP ${item.opNumero} / ${item.lote} / ${item.modeloCodigo}`).join("   |   ");
    const linhas = doc.splitTextToSize(limpar(textoOps), largura - 8) as string[];
    garantir(11 + linhas.length * 4);
    doc.setFillColor(250, 247, 235);
    doc.setDrawColor(232, 202, 119);
    doc.roundedRect(margem, y, largura, 7 + linhas.length * 4, 1, 1, "FD");
    texto("OPS SELECIONADAS", margem + 4, y + 5, 5.5, true, AMBER);
    linhas.forEach((linha, indice) => texto(linha, margem + 40, y + 5 + indice * 4, 6.4, indice === 0, INK));
    y += 11 + linhas.length * 4;
  }

  function cabecalhoTabela() {
    const colunas = [13, 44, 30, 77, 34, 35, 40];
    const titulos = ["SEQ.", "OP / LOTE", "MODELO", "PECA", "COMPRIMENTO", "POR BARRA", "TOTAL PLANO"];
    doc.setFillColor(...NAVY);
    doc.rect(margem, y, largura, 8, "F");
    let x = margem;
    titulos.forEach((titulo, indice) => {
      texto(titulo, indice >= 4 ? x + colunas[indice] - 2 : x + 2, y + 5.2, 5.7, true, [255, 255, 255], indice >= 4 ? "right" : "left");
      x += colunas[indice];
    });
    y += 8;
  }

  function padrao(padraoAtual: PlanoPdf["padroes"][number]) {
    const altura = 38 + padraoAtual.itens.length * 8;
    garantir(Math.min(altura, 75));
    texto(`${padraoAtual.codigo} - TUBO ${numero(padraoAtual.perfilMm)} x ${numero(padraoAtual.perfilMm)} x ${numero(padraoAtual.espessuraMm, 1)} mm`, margem, y + 4, 8.5, true, NAVY);
    texto(`REPETIR EM ${padraoAtual.repeticoes} BARRA(S)`, paginaW - margem, y + 4, 8, true, CYAN, "right");
    y += 8;

    doc.setFillColor(230, 236, 242);
    doc.setDrawColor(...LINE);
    doc.roundedRect(margem, y, largura, 9, 1, 1, "FD");
    let x = margem;
    padraoAtual.itens.forEach((item, indice) => {
      const w = Math.max(2, (item.quantidadePorBarra * item.comprimentoUnitarioMm / padraoAtual.comprimentoBarraMm) * largura);
      doc.setFillColor(...SEGMENTOS[indice % SEGMENTOS.length]);
      doc.rect(x, y, Math.min(w, margem + largura - x), 9, "F");
      if (w > 19) texto(`${item.quantidadePorBarra}x ${item.pecaCodigo}`, x + w / 2, y + 5.8, 5.3, true, NAVY, "center");
      x += w;
    });
    y += 12;
    texto(`Pecas: ${numero(padraoAtual.comprimentoPecasPorBarraMm, 1)} mm`, margem, y, 6.2, true, INK);
    texto(`Serra: ${numero(padraoAtual.perdaCortesPorBarraMm, 1)} mm`, margem + 58, y, 6.2, false, MUTED);
    texto(`Refile: ${numero(padraoAtual.refileInicialMm, 1)} mm`, margem + 106, y, 6.2, false, MUTED);
    texto(`Sobra por barra: ${numero(padraoAtual.sobraPorBarraMm, 1)} mm`, margem + 151, y, 6.2, true, AMBER);
    texto(`Aproveitamento: ${numero(padraoAtual.aproveitamentoPct, 1)}%`, paginaW - margem, y, 6.2, true, CYAN, "right");
    y += 5;
    cabecalhoTabela();

    const colunas = [13, 44, 30, 77, 34, 35, 40];
    padraoAtual.itens.forEach((item, indice) => {
      if (y + 8 > limiteY) {
        novaPagina();
        texto(`${padraoAtual.codigo} - CONTINUACAO`, margem, y + 4, 8, true, NAVY);
        y += 8;
        cabecalhoTabela();
      }
      if (indice % 2) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margem, y, largura, 8, "F");
      }
      const valores = [
        String(indice + 1),
        `OP ${item.opNumero} / ${item.lote}`,
        item.modeloCodigo,
        `${item.pecaCodigo} - ${item.pecaNome}`,
        `${numero(item.comprimentoUnitarioMm, 1)} mm`,
        String(item.quantidadePorBarra),
        String(item.quantidadeTotal),
      ];
      let cx = margem;
      valores.forEach((valor, coluna) => {
        const exibido = (doc.splitTextToSize(limpar(valor), colunas[coluna] - 4) as string[])[0];
        texto(exibido, coluna >= 4 ? cx + colunas[coluna] - 2 : cx + 2, y + 5.2, 6, coluna === 0 || coluna === 3, coluna === 0 ? CYAN : INK, coluna >= 4 ? "right" : "left");
        cx += colunas[coluna];
      });
      doc.setDrawColor(...LINE);
      doc.line(margem, y + 8, paginaW - margem, y + 8);
      y += 8;
    });
    y += 7;
  }

  doc.setProperties({ title: `Plano de corte ${plano.codigo}`, subject: "Sequencia orientativa para tubos de 6 metros", author: "Engates Brucke" });
  cabecalho(true);
  secao("Resumo do plano");
  indicadores();
  listaOps();
  secao("Sequencia de corte por perfil e padrao");
  plano.padroes.forEach(padrao);

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setDrawColor(...LINE);
    doc.line(margem, paginaH - 10, paginaW - margem, paginaH - 10);
    texto(`ENGATES BRUCKE | ${plano.codigo} | Plano orientativo - nao e apontamento de producao`, margem, paginaH - 5.5, 5.8, false, MUTED);
    texto(`Pagina ${pagina} de ${paginas}`, paginaW - margem, paginaH - 5.5, 5.8, true, MUTED, "right");
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
