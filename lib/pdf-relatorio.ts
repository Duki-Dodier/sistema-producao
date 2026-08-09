type KpiPdf = { label: string; value: string };
type SecaoPdf = {
  titulo: string;
  colunas: { titulo: string; largura: number; alinhar?: "left" | "right" }[];
  linhas: string[][];
};

type RelatorioPdf = {
  titulo: string;
  subtitulo: string;
  periodo: string;
  orientacao?: "retrato" | "paisagem";
  kpis: KpiPdf[];
  secoes: SecaoPdf[];
};

const LARGURA = 595;
const ALTURA = 842;
const MARGEM = 38;

function cor(r: number, g: number, b: number) {
  return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
}

function normalizarTexto(texto: string) {
  return texto
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/º/g, "o")
    .replace(/ª/g, "a");
}

function escaparPdf(texto: string) {
  const normalizado = normalizarTexto(texto);
  let resultado = "";
  for (const caractere of normalizado) {
    const codigo = caractere.charCodeAt(0);
    const seguro = codigo <= 255 ? caractere : "?";
    resultado += seguro === "\\" || seguro === "(" || seguro === ")" ? `\\${seguro}` : seguro;
  }
  return resultado.replace(/[\r\n]+/g, " ");
}

function limitar(texto: string, largura: number, tamanho: number) {
  const maximo = Math.max(3, Math.floor(largura / (tamanho * 0.51)));
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo - 3)}...`;
}

class DocumentoPdf {
  private paginas: string[][] = [];
  private pagina: string[] = [];
  private y = 0;
  private larguraPagina: number;
  private alturaPagina: number;
  private titulo = "";
  private subtitulo = "";
  private periodo = "";

  constructor(private relatorio: RelatorioPdf) {
    this.larguraPagina = relatorio.orientacao === "paisagem" ? ALTURA : LARGURA;
    this.alturaPagina = relatorio.orientacao === "paisagem" ? LARGURA : ALTURA;
    this.titulo = relatorio.titulo;
    this.subtitulo = relatorio.subtitulo;
    this.periodo = relatorio.periodo;
    this.novaPagina();
  }

  private retangulo(x: number, yTopo: number, largura: number, altura: number, preenchimento: string, borda?: string) {
    const y = this.alturaPagina - yTopo - altura;
    this.pagina.push(`${preenchimento} rg`);
    if (borda) this.pagina.push(`${borda} RG 0.6 w`);
    this.pagina.push(`${x} ${y} ${largura} ${altura} re ${borda ? "B" : "f"}`);
  }

  private texto(texto: string, x: number, yTopo: number, tamanho = 10, negrito = false, fill = cor(31, 41, 55), alinhar: "left" | "right" = "left", largura = 0) {
    const conteudo = escaparPdf(texto);
    const estimada = conteudo.length * tamanho * 0.51;
    const posX = alinhar === "right" && largura ? x + largura - estimada : x;
    this.pagina.push(`BT /${negrito ? "F2" : "F1"} ${tamanho} Tf ${fill} rg 1 0 0 1 ${Math.max(x, posX).toFixed(1)} ${(this.alturaPagina - yTopo).toFixed(1)} Tm (${conteudo}) Tj ET`);
  }

  private novaPagina() {
    if (this.pagina.length) this.paginas.push(this.pagina);
    this.pagina = [];
    this.retangulo(0, 0, this.larguraPagina, 64, cor(15, 29, 52));
    this.texto(this.titulo, MARGEM, 29, 18, true, cor(255, 255, 255));
    this.texto(this.subtitulo, MARGEM, 48, 8.5, false, cor(165, 180, 202));
    this.texto(this.periodo, this.larguraPagina - MARGEM - 185, 34, 9, true, cor(191, 219, 254), "right", 185);
    this.y = 82;
  }

  private garantir(altura: number) {
    if (this.y + altura > this.alturaPagina - 42) this.novaPagina();
  }

  adicionarKpis(kpis: KpiPdf[]) {
    const largura = (this.larguraPagina - MARGEM * 2 - 12) / 4;
    kpis.forEach((kpi, indice) => {
      if (indice > 0 && indice % 4 === 0) this.y += 66;
      const coluna = indice % 4;
      const x = MARGEM + coluna * (largura + 4);
      this.retangulo(x, this.y, largura, 58, cor(244, 247, 251), cor(218, 226, 237));
      this.texto(limitar(kpi.label.toUpperCase(), largura - 16, 7.5), x + 8, this.y + 18, 7.5, true, cor(100, 116, 139));
      this.texto(limitar(kpi.value, largura - 16, 16), x + 8, this.y + 43, 16, true, cor(15, 118, 110));
    });
    this.y += 74;
  }

  adicionarSecao(secao: SecaoPdf) {
    this.garantir(62);
    this.texto(secao.titulo, MARGEM, this.y, 12, true, cor(15, 29, 52));
    this.y += 12;
    this.desenharCabecalho(secao);
    if (!secao.linhas.length) {
      this.texto("Nenhum registro no período selecionado.", MARGEM + 8, this.y + 16, 9, false, cor(100, 116, 139));
      this.y += 34;
      return;
    }
    secao.linhas.forEach((linha, indice) => {
      if (this.y + 21 > this.alturaPagina - 42) {
        this.novaPagina();
        this.texto(`${secao.titulo} (continuação)`, MARGEM, this.y, 12, true, cor(15, 29, 52));
        this.y += 12;
        this.desenharCabecalho(secao);
      }
      if (indice % 2 === 1) this.retangulo(MARGEM, this.y, this.larguraPagina - MARGEM * 2, 20, cor(248, 250, 252));
      let x = MARGEM;
      linha.forEach((valor, coluna) => {
        const config = secao.colunas[coluna];
        if (!config) return;
        const texto = limitar(String(valor), config.largura - 10, 8.2);
        this.texto(texto, x + 5, this.y + 13.5, 8.2, coluna === 0, cor(51, 65, 85), config.alinhar ?? "left", config.largura - 10);
        x += config.largura;
      });
      this.pagina.push(`${cor(226, 232, 240)} RG 0.35 w ${MARGEM} ${(this.alturaPagina - this.y - 20).toFixed(1)} ${this.larguraPagina - MARGEM * 2} 0 re S`);
      this.y += 20;
    });
    this.y += 18;
  }

  private desenharCabecalho(secao: SecaoPdf) {
    this.garantir(28);
    this.retangulo(MARGEM, this.y, this.larguraPagina - MARGEM * 2, 24, cor(225, 234, 246));
    let x = MARGEM;
    for (const coluna of secao.colunas) {
      this.texto(limitar(coluna.titulo.toUpperCase(), coluna.largura - 10, 7.3), x + 5, this.y + 16, 7.3, true, cor(51, 65, 85), coluna.alinhar ?? "left", coluna.largura - 10);
      x += coluna.largura;
    }
    this.y += 24;
  }

  finalizar() {
    if (this.pagina.length) this.paginas.push(this.pagina);
    this.paginas.forEach((pagina, indice) => {
      pagina.push(`${cor(203, 213, 225)} RG 0.5 w ${MARGEM} 28 ${this.larguraPagina - MARGEM * 2} 0 re S`);
      pagina.push(`BT /F1 7.5 Tf ${cor(100, 116, 139)} rg 1 0 0 1 ${MARGEM} 16 Tm (MES - Fábrica de Engates) Tj ET`);
      pagina.push(`BT /F1 7.5 Tf ${cor(100, 116, 139)} rg 1 0 0 1 ${this.larguraPagina - MARGEM - 55} 16 Tm (Página ${indice + 1}) Tj ET`);
    });
    return montarArquivoPdf(this.paginas, this.larguraPagina, this.alturaPagina);
  }
}

function bufferLatin1(texto: string) {
  return Buffer.from(texto, "latin1");
}

function montarArquivoPdf(paginas: string[][], larguraPagina: number, alturaPagina: number) {
  const objetos: Buffer[] = [];
  const idsPaginas = paginas.map((_, indice) => 5 + indice * 2);
  objetos[1] = bufferLatin1("<< /Type /Catalog /Pages 2 0 R >>");
  objetos[2] = bufferLatin1(`<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(" ")}] /Count ${paginas.length} >>`);
  objetos[3] = bufferLatin1("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objetos[4] = bufferLatin1("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  paginas.forEach((comandos, indice) => {
    const paginaId = 5 + indice * 2;
    const conteudoId = paginaId + 1;
    const stream = bufferLatin1(comandos.join("\n"));
    objetos[paginaId] = bufferLatin1(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${larguraPagina} ${alturaPagina}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${conteudoId} 0 R >>`);
    objetos[conteudoId] = Buffer.concat([bufferLatin1(`<< /Length ${stream.length} >>\nstream\n`), stream, bufferLatin1("\nendstream")]);
  });

  const partes: Buffer[] = [bufferLatin1("%PDF-1.4\n%âãÏÓ\n")];
  const offsets = [0];
  let tamanho = partes[0].length;
  for (let id = 1; id < objetos.length; id++) {
    offsets[id] = tamanho;
    const objeto = Buffer.concat([bufferLatin1(`${id} 0 obj\n`), objetos[id], bufferLatin1("\nendobj\n")]);
    partes.push(objeto);
    tamanho += objeto.length;
  }
  const inicioXref = tamanho;
  const xref = [`xref`, `0 ${objetos.length}`, "0000000000 65535 f "];
  for (let id = 1; id < objetos.length; id++) xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n `);
  xref.push(`trailer`, `<< /Size ${objetos.length} /Root 1 0 R >>`, `startxref`, String(inicioXref), `%%EOF`);
  partes.push(bufferLatin1(`${xref.join("\n")}\n`));
  return Buffer.concat(partes);
}

export function gerarPdfRelatorio(relatorio: RelatorioPdf) {
  const documento = new DocumentoPdf(relatorio);
  documento.adicionarKpis(relatorio.kpis);
  for (const secao of relatorio.secoes) documento.adicionarSecao(secao);
  return documento.finalizar();
}
