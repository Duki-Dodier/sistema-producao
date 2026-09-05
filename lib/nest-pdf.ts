import { jsPDF } from "jspdf";

export type DadosPdfNest = {
  codigo: string; status: string; setor: string; maquina: string; programador: string; material: string;
  espessuraMm: number | null; larguraChapaMm: number | null; alturaChapaMm: number | null;
  quantidadeChapas: number; aproveitamentoPct: number | null; tempoCorteSegundos: number | null;
  numeroPiercings: number | null; comprimentoCorteMm: number | null; comprimentoRapidoMm: number | null;
  pesoChapaKg: number | null; nomeArquivo: string | null; observacao: string | null; criadoEm: Date;
  itens: Array<{ codigo: string; nome: string; medida: string | null; op: string; modelo: string; planejado: number; declarado: number; liberado: number; perdas: number }>;
};

const NAVY: [number, number, number] = [15, 29, 52];
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [91, 105, 125];
const LINE: [number, number, number] = [203, 213, 225];
const PALE: [number, number, number] = [244, 247, 250];
const CYAN: [number, number, number] = [8, 145, 178];

function limpar(valor: unknown) { return String(valor ?? "-").replace(/[–—−]/g, "-").replace(/…/g, "..."); }
function numero(valor: number | null, sufixo = "") { return valor === null ? "-" : `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${sufixo}`; }
function tempo(segundos: number | null) {
  if (segundos === null) return "-";
  return [Math.floor(segundos / 3600), Math.floor((segundos % 3600) / 60), segundos % 60].map(item => String(item).padStart(2, "0")).join(":");
}

export function gerarPdfNest(dados: DadosPdfNest, qrDataUrl: string, logo?: Uint8Array) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const paginaW = 210, margem = 14, largura = 182, limiteY = 278;
  let y = 46;
  function fonte(tamanho: number, negrito = false, cor: [number, number, number] = INK) { doc.setFont("helvetica", negrito ? "bold" : "normal"); doc.setFontSize(tamanho); doc.setTextColor(...cor); }
  function texto(valor: unknown, x: number, topo: number, tamanho = 8, negrito = false, cor: [number, number, number] = INK, opcoes?: { align?: "left" | "center" | "right" }) { fonte(tamanho, negrito, cor); doc.text(limpar(valor), x, topo, opcoes); }
  function linhas(valor: unknown, larguraMax: number, tamanho = 8) { fonte(tamanho); return doc.splitTextToSize(limpar(valor), larguraMax) as string[]; }
  function cabecalho(primeira = false) {
    doc.setFillColor(...NAVY); doc.rect(0, 0, paginaW, primeira ? 37 : 20, "F");
    if (!primeira) { texto(`ORDEM TÉCNICA DE CORTE  |  ${dados.codigo}`, margem, 12.5, 10, true, [255, 255, 255]); texto("CONTINUAÇÃO", paginaW - margem, 12.5, 7, true, [148, 220, 235], { align: "right" }); return; }
    doc.setFillColor(255, 255, 255); doc.roundedRect(margem, 7, 31, 21, 1.2, 1.2, "F");
    if (logo) doc.addImage(logo, "PNG", margem + 2, 9, 27, 17, undefined, "FAST"); else texto("BRUCKE", margem + 15.5, 20, 11, true, NAVY, { align: "center" });
    texto("ORDEM TÉCNICA DE CORTE", 50, 13, 9, true, [148, 220, 235]); texto(dados.codigo, 50, 24, 17, true, [255, 255, 255]);
    texto(`${dados.setor}  |  ${dados.maquina}`, 50, 31, 8, false, [207, 226, 243]);
    doc.setFillColor(255, 255, 255); doc.roundedRect(169, 4.5, 27, 27, 1.2, 1.2, "F"); doc.addImage(qrDataUrl, "PNG", 171, 6.5, 23, 23);
    texto("LER PARA OPERAR", 182.5, 35, 6, true, [226, 232, 240], { align: "center" });
  }
  function novaPagina() { doc.addPage(); cabecalho(); y = 28; }
  function garantir(altura: number) { if (y + altura > limiteY) novaPagina(); }
  function tituloSecao(titulo: string) { garantir(11); texto(titulo.toUpperCase(), margem, y + 4, 8, true, NAVY); doc.setDrawColor(...CYAN); doc.setLineWidth(0.8); doc.line(margem, y + 7, margem + 28, y + 7); y += 12; }
  function grade(informacoes: Array<[string, string]>, colunas = 3) {
    const gap = 2.5, colW = (largura - gap * (colunas - 1)) / colunas;
    for (let i = 0; i < informacoes.length; i += colunas) {
      const grupo = informacoes.slice(i, i + colunas), valores = grupo.map(item => linhas(item[1], colW - 6, 8));
      const altura = Math.max(16, 10 + Math.max(...valores.map(v => v.length)) * 3.7); garantir(altura + 2.5);
      grupo.forEach(([rotulo], coluna) => { const x = margem + coluna * (colW + gap); doc.setFillColor(...PALE); doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.roundedRect(x, y, colW, altura, 1, 1, "FD"); texto(rotulo.toUpperCase(), x + 3, y + 5, 6.2, true, MUTED); valores[coluna].forEach((linha, indice) => texto(linha, x + 3, y + 10.5 + indice * 3.7, 8, true, INK)); });
      y += altura + 2.5;
    }
  }
  const colunas = [76, 34, 18, 18, 18, 18];
  function tabelaCabecalho() {
    garantir(9); const titulos = ["PEÇA / DESCRIÇÃO", "OP / MODELO", "PLANO", "DECL.", "LIBER.", "PERDA"];
    doc.setFillColor(...NAVY); doc.rect(margem, y, largura, 9, "F"); let x = margem;
    titulos.forEach((titulo, i) => { texto(titulo, i < 2 ? x + 2 : x + colunas[i] - 2, y + 5.8, 6.2, true, [255, 255, 255], i < 2 ? undefined : { align: "right" }); x += colunas[i]; }); y += 9;
  }

  doc.setProperties({ title: `Ordem técnica de corte ${dados.codigo}`, subject: "Rastreabilidade do Plasma - Engates Brucke", author: "Engates Brucke" }); cabecalho(true);
  tituloSecao("Identificação da programação");
  grade([["Situação", dados.status], ["Programador", dados.programador], ["Emissão", dados.criadoEm.toLocaleString("pt-BR")], ["Material", dados.material], ["Espessura", numero(dados.espessuraMm, " mm")], ["Chapa", dados.larguraChapaMm === null || dados.alturaChapaMm === null ? "-" : `${numero(dados.larguraChapaMm)} x ${numero(dados.alturaChapaMm)} mm`], ["Quantidade de chapas", String(dados.quantidadeChapas)], ["Aproveitamento", numero(dados.aproveitamentoPct, "%")], ["Arquivo / referência", limpar(dados.nomeArquivo)]]);
  tituloSecao("Sequência obrigatória no operador");
  const passos = ["1  Ler o QR Code", "2  Iniciar o corte", "3  Registrar boas e perdas", "4  Concluir o NEST"], passoW = 44;
  passos.forEach((passo, i) => { const x = margem + i * (passoW + 2); doc.setFillColor(235, 247, 250); doc.setDrawColor(148, 220, 235); doc.roundedRect(x, y, passoW, 12, 1, 1, "FD"); texto(passo, x + passoW / 2, y + 7.5, 6.6, true, NAVY, { align: "center" }); }); y += 17;
  tituloSecao("Peças programadas"); tabelaCabecalho();
  dados.itens.forEach((item, indice) => {
    const desc = linhas(`${item.codigo} - ${item.nome}${item.medida ? ` (${item.medida})` : ""}`, colunas[0] - 4, 7.4), op = linhas(`${item.op} / ${item.modelo}`, colunas[1] - 4, 7.1);
    const altura = Math.max(11, 5 + Math.max(desc.length, op.length) * 3.5); if (y + altura > limiteY) { novaPagina(); tabelaCabecalho(); }
    if (indice % 2) { doc.setFillColor(248, 250, 252); doc.rect(margem, y, largura, altura, "F"); }
    let x = margem; desc.forEach((linha, j) => texto(linha, x + 2, y + 5.2 + j * 3.5, 7.4, j === 0, INK)); x += colunas[0]; op.forEach((linha, j) => texto(linha, x + 2, y + 5.2 + j * 3.5, 7.1, false, MUTED)); x += colunas[1];
    [item.planejado, item.declarado, item.liberado, item.perdas].forEach((valor, j) => { texto(String(valor), x + colunas[j + 2] - 2, y + 6.2, 8, true, j === 2 ? [4, 120, 87] : j === 3 ? [190, 24, 63] : INK, { align: "right" }); x += colunas[j + 2]; });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(margem, y + altura, margem + largura, y + altura); y += altura;
  });
  y += 5; tituloSecao("Parâmetros técnicos");
  grade([["Tempo previsto", tempo(dados.tempoCorteSegundos)], ["Perfurações", numero(dados.numeroPiercings)], ["Comprimento de corte", numero(dados.comprimentoCorteMm, " mm")], ["Movimento rápido", numero(dados.comprimentoRapidoMm, " mm")], ["Peso da chapa", numero(dados.pesoChapaKg, " kg")], ["Controle", "Conferência obrigatória antes da liberação"]]);
  if (dados.observacao) {
    tituloSecao("Observações"); const restantes = linhas(dados.observacao, largura - 8, 8);
    while (restantes.length) { const cabem = Math.max(1, Math.floor((limiteY - y - 10) / 4)), bloco = restantes.splice(0, cabem), altura = 9 + bloco.length * 4; garantir(altura); doc.setFillColor(255, 251, 235); doc.setDrawColor(245, 158, 11); doc.roundedRect(margem, y, largura, altura, 1, 1, "FD"); bloco.forEach((linha, i) => texto(linha, margem + 4, y + 7 + i * 4, 8, false, [120, 53, 15])); y += altura + 3; if (restantes.length) novaPagina(); }
  }
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) { doc.setPage(pagina); doc.setDrawColor(...LINE); doc.line(margem, 285, paginaW - margem, 285); texto(`ENGATES BRUCKE  |  ${dados.codigo}  |  Documento controlado`, margem, 290.5, 6.5, false, MUTED); texto(`Página ${pagina} de ${paginas}`, paginaW - margem, 290.5, 6.5, true, MUTED, { align: "right" }); }
  return new Uint8Array(doc.output("arraybuffer"));
}
