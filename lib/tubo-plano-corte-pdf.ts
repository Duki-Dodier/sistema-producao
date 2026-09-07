import { jsPDF } from "jspdf";
import { nomePerfilTubo } from "@/lib/tubo-plano-corte";

type DadosPlanoPdf = {
  codigo: string; status: string; emitidoEm: Date; criadoPor: { nome: string };
  maquina: { codigo: string; nome: string } | null;
  comprimentoBarraMm: number; perdaCorteMm: number; margemInicialMm: number; margemFinalMm: number; minimoSobraMm: number;
  totalBarrasNovas: number; totalSobrasUsadas: number; totalPecas: number; comprimentoPecasMm: number;
  desperdicioPrevistoMm: number; sobraReutilizavelPrevistaMm: number; aproveitamentoPct: number;
  barras: Array<{
    ordem: number; perfilA: number; perfilB: number | null; espessuraMm: number; origem: string;
    comprimentoOrigemMm: number; sobraOrigemId: number | null; sobraPrevistaMm: number; aproveitamentoPct: number;
    itens: Array<{ quantidade: number; comprimentoUnitarioMm: number; op: { numeroSequencia: number; lote: string | null; modelo: { codigo: string } }; peca: { codigo: string; nome: string } }>;
  }>;
};

const NAVY: [number, number, number] = [11, 28, 49];
const CYAN: [number, number, number] = [20, 184, 220];
const INK: [number, number, number] = [25, 39, 58];
const MUTED: [number, number, number] = [90, 105, 125];
const LINE: [number, number, number] = [202, 212, 224];
const SEGMENTOS: Array<[number, number, number]> = [[34, 211, 238], [56, 189, 248], [52, 211, 153], [251, 191, 36], [167, 139, 250], [251, 113, 133]];

const limpar = (valor: unknown) => String(valor ?? "-").replace(/[–—−]/g, "-").replace(/…/g, "...");
const fmm = (valor: number) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mm`;

export function gerarPdfPlanoCorteTubo(plano: DadosPlanoPdf, logo?: Uint8Array) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const paginaW = 297, paginaH = 210, margem = 11, largura = paginaW - margem * 2, limiteY = 194;
  let y = 39;
  function fonte(tamanho: number, negrito = false, cor: [number, number, number] = INK) { doc.setFont("helvetica", negrito ? "bold" : "normal"); doc.setFontSize(tamanho); doc.setTextColor(...cor); }
  function texto(valor: unknown, x: number, py: number, tamanho = 7, negrito = false, cor: [number, number, number] = INK, align?: "left" | "center" | "right") { fonte(tamanho, negrito, cor); doc.text(limpar(valor), x, py, align ? { align } : undefined); }
  function cabecalho() {
    doc.setFillColor(...NAVY); doc.rect(0, 0, paginaW, 30, "F");
    doc.setFillColor(255, 255, 255); doc.roundedRect(margem, 5, 35, 20, 1, 1, "F");
    if (logo) doc.addImage(logo, "PNG", margem + 3, 7, 29, 16, undefined, "FAST"); else texto("BRUCKE", margem + 17.5, 17, 11, true, NAVY, "center");
    texto("PLANO TÉCNICO DE CORTE · TUBO", 53, 12, 8, true, [150, 225, 240]);
    texto(plano.codigo, 53, 22, 16, true, [255, 255, 255]);
    texto(`${plano.status}  |  ${plano.maquina ? `${plano.maquina.codigo} · ${plano.maquina.nome}` : "MÁQUINA NÃO DEFINIDA"}`, paginaW - margem, 18, 8, true, [255, 255, 255], "right");
  }
  function novaPagina() { doc.addPage(); cabecalho(); y = 38; }
  function garantir(altura: number) { if (y + altura > limiteY) novaPagina(); }
  function titulo(valor: string) { garantir(9); texto(valor.toUpperCase(), margem, y + 4, 7.5, true, NAVY); doc.setDrawColor(...CYAN); doc.setLineWidth(0.7); doc.line(margem, y + 7, margem + 32, y + 7); y += 11; }
  function indicadores() {
    const dados = [
      ["RESPONSÁVEL", plano.criadoPor.nome], ["EMISSÃO", plano.emitidoEm.toLocaleString("pt-BR")],
      ["PEÇAS", String(plano.totalPecas)], ["BARRAS NOVAS", String(plano.totalBarrasNovas)],
      ["SOBRAS USADAS", String(plano.totalSobrasUsadas)], ["APROVEITAMENTO", `${plano.aproveitamentoPct.toFixed(1)}%`],
      ["METROS ÚTEIS", `${(plano.comprimentoPecasMm / 1000).toFixed(2)} m`], ["DESPERDÍCIO", `${(plano.desperdicioPrevistoMm / 1000).toFixed(2)} m`],
      ["SOBRA PREVISTA", `${(plano.sobraReutilizavelPrevistaMm / 1000).toFixed(2)} m`], ["SERRA / MARGENS", `${plano.perdaCorteMm} / ${plano.margemInicialMm}+${plano.margemFinalMm} mm`],
    ];
    const gap = 2, colW = (largura - gap * 4) / 5;
    dados.forEach(([rotulo, valor], indice) => {
      const linha = Math.floor(indice / 5), coluna = indice % 5, x = margem + coluna * (colW + gap), py = y + linha * 14;
      doc.setFillColor(244, 247, 250); doc.setDrawColor(...LINE); doc.roundedRect(x, py, colW, 11.5, 1, 1, "FD");
      texto(rotulo, x + 2.5, py + 4, 5.3, true, MUTED); texto(valor, x + 2.5, py + 8.8, 7.2, true, INK);
    });
    y += 31;
  }
  function barraVisual(barra: DadosPlanoPdf["barras"][number]) {
    garantir(36 + barra.itens.length * 5.7);
    texto(`BARRA ${String(barra.ordem).padStart(3, "0")}  |  ${nomePerfilTubo(barra.perfilA, barra.perfilB, barra.espessuraMm)}`, margem, y + 4, 8, true, NAVY);
    texto(`${barra.origem === "SOBRA" ? `SOBRA #${barra.sobraOrigemId}` : "NOVA 6.000 mm"}  |  APROV. ${barra.aproveitamentoPct.toFixed(1)}%  |  SOBRA ${fmm(barra.sobraPrevistaMm)}`, paginaW - margem, y + 4, 6.5, true, MUTED, "right");
    y += 7;
    doc.setDrawColor(...LINE); doc.setFillColor(231, 236, 242); doc.roundedRect(margem, y, largura, 9, 1, 1, "FD");
    let x = margem;
    barra.itens.forEach((item, indice) => {
      const w = Math.max((item.quantidade * item.comprimentoUnitarioMm / barra.comprimentoOrigemMm) * largura, 2);
      doc.setFillColor(...SEGMENTOS[indice % SEGMENTOS.length]); doc.rect(x, y, Math.min(w, margem + largura - x), 9, "F");
      if (w > 17) texto(`${item.quantidade}x ${item.peca.codigo}`, x + w / 2, y + 5.8, 5.5, true, NAVY, "center");
      x += w;
    });
    y += 12;
    doc.setFillColor(...NAVY); doc.rect(margem, y, largura, 7, "F");
    const colunas = [17, 36, 31, 93, 18, 29, 51]; const titulos = ["SEQ.", "OP / LOTE", "MODELO", "PEÇA", "QTDE.", "COMPRIMENTO", "CONSUMO C/ SERRA"];
    let cx = margem; titulos.forEach((item, indice) => { texto(item, indice >= 4 ? cx + colunas[indice] - 2 : cx + 2, y + 4.7, 5.3, true, [255,255,255], indice >= 4 ? "right" : undefined); cx += colunas[indice]; }); y += 7;
    barra.itens.forEach((item, indice) => {
      if (indice % 2) { doc.setFillColor(247, 249, 252); doc.rect(margem, y, largura, 5.7, "F"); }
      const valores = [String(indice + 1), `OP ${item.op.numeroSequencia} / ${item.op.lote ?? "-"}`, item.op.modelo.codigo, `${item.peca.codigo} - ${item.peca.nome}`, String(item.quantidade), fmm(item.comprimentoUnitarioMm), fmm(item.quantidade * (item.comprimentoUnitarioMm + plano.perdaCorteMm))];
      let vx = margem; valores.forEach((valor, col) => { const max = colunas[col] - 4; const exibido = doc.splitTextToSize(valor, max)[0]; texto(exibido, col >= 4 ? vx + colunas[col] - 2 : vx + 2, y + 4, 5.8, col === 0 || col === 3, col === 0 ? CYAN : INK, col >= 4 ? "right" : undefined); vx += colunas[col]; });
      doc.setDrawColor(...LINE); doc.line(margem, y + 5.7, margem + largura, y + 5.7); y += 5.7;
    });
    y += 5;
  }

  doc.setProperties({ title: `Plano de corte ${plano.codigo}`, subject: "Aproveitamento de tubos de 6 metros", author: "Engates Brucke" });
  cabecalho(); titulo("Identificação e aproveitamento"); indicadores(); titulo("Sequência numerada por perfil e barra");
  for (const barra of plano.barras) barraVisual(barra);
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) { doc.setPage(pagina); doc.setDrawColor(...LINE); doc.line(margem, paginaH - 10, paginaW - margem, paginaH - 10); texto(`ENGATES BRUCKE  |  ${plano.codigo}  |  Documento controlado`, margem, paginaH - 5.5, 5.8, false, MUTED); texto(`Página ${pagina} de ${paginas}`, paginaW - margem, paginaH - 5.5, 5.8, true, MUTED, "right"); }
  return new Uint8Array(doc.output("arraybuffer"));
}
