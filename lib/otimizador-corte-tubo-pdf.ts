import { jsPDF } from "jspdf";
import type { ResultadoOtimizacaoTubo } from "@/lib/otimizador-corte-tubo";

export function gerarPdfOtimizadorTubos(resultado: ResultadoOtimizacaoTubo): Uint8Array {
  // A4 Paisagem (Landscape): 297mm largura × 210mm altura
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pagW = 297;
  const pagH = 210;
  const margem = 10;
  const largUtil = pagW - margem * 2; // 277mm
  const limiteY = 195;

  let y = 10;

  function cabecalho(numeroPagina = 1) {
    // Topo estilizado
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margem, 8, largUtil, 18, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("PLANO OPERACIONAL DE CORTE DE TUBOS · BARRAS DE 6 METROS", margem + 4, 15);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Sequência otimizada de corte (1D-CSP) · Emitido em: ${new Date().toLocaleString("pt-BR")}`,
      margem + 4,
      21
    );

    // Métricas no topo direito
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(56, 189, 248); // sky-400
    doc.text(
      `TOTAL: ${resultado.resumoGeral.totalBarras6m} BARRAS DE 6m  |  ${resultado.resumoGeral.aproveitamentoMedioPct}% APROVEITAMENTO`,
      pagW - margem - 4,
      15,
      { align: "right" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `OPs: ${resultado.resumoGeral.totalOpsAtendidas}  |  Peças: ${resultado.resumoGeral.totalPecas}  |  Pág. ${numeroPagina}`,
      pagW - margem - 4,
      21,
      { align: "right" }
    );

    y = 30;
  }

  let pagAtual = 1;
  cabecalho(pagAtual);

  function checarEspaco(alturaNecessaria: number) {
    if (y + alturaNecessaria > limiteY) {
      doc.addPage();
      pagAtual++;
      cabecalho(pagAtual);
    }
  }

  // Percorrer cada perfil de tubo
  resultado.perfis.forEach((perfil) => {
    checarEspaco(35);

    // Faixa do Perfil
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.roundedRect(margem, y, largUtil, 8, 1, 1, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`MATERIAL: ${perfil.perfil.toUpperCase()}`, margem + 3, y + 5.5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(
      `${perfil.totalBarras6m} barras de 6m  ·  ${perfil.totalPecas} peças  ·  ${perfil.padroes.length} padrões de corte  ·  Aprov: ${perfil.aproveitamentoMedioPct}%`,
      pagW - margem - 3,
      y + 5.5,
      { align: "right" }
    );

    y += 11;

    // TABELA DE PADRÕES DE CORTE (O operador usa para programar a serra)
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margem, y, largUtil, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);

    doc.text("PADRÃO", margem + 2, y + 4.2);
    doc.text("REPETIÇÃO (BARRAS)", margem + 18, y + 4.2);
    doc.text("RECEITA DE CORTE NA BARRA DE 6.000 mm", margem + 52, y + 4.2);
    doc.text("ÚTIL (mm)", margem + 185, y + 4.2, { align: "right" });
    doc.text("SOBRA PONTA (cm)", margem + 225, y + 4.2, { align: "right" });
    doc.text("APROV.", margem + 248, y + 4.2, { align: "right" });
    doc.text("OK", margem + 268, y + 4.2, { align: "center" });

    y += 6;

    perfil.padroes.forEach((padrao, idx) => {
      // Altura da linha do padrão com a barra gráfica
      const altLinha = 14;
      checarEspaco(altLinha + 2);

      // Fundo zebra
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margem, y, largUtil, altLinha, "F");
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(margem, y + altLinha, pagW - margem, y + altLinha);

      // ID do Padrão
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(padrao.idPadrao, margem + 2, y + 5);

      // Quantidade de barras a repetir
      doc.setFontSize(8.5);
      doc.setTextColor(2, 132, 199); // sky-600
      doc.text(`${padrao.quantidadeBarras} BARRAS`, margem + 18, y + 5);

      // Texto da receita
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(padrao.receitaTexto, margem + 52, y + 5);

      // Útil
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(`${padrao.comprimentoUtilMm} mm`, margem + 185, y + 5, { align: "right" });

      // Sobra na ponta em cm (Destaque!)
      doc.setFont("helvetica", "bold");
      if (padrao.sobraMm <= 100) {
        doc.setTextColor(22, 101, 52);
      } else if (padrao.sobraMm <= 300) {
        doc.setTextColor(180, 83, 9);
      } else {
        doc.setTextColor(185, 28, 28);
      }
      doc.text(`${padrao.sobraCm} cm (${padrao.sobraMm}mm)`, margem + 225, y + 5, { align: "right" });

      // Aproveitamento
      doc.setTextColor(30, 41, 59);
      doc.text(`${padrao.aproveitamentoPct}%`, margem + 248, y + 5, { align: "right" });

      // Checkbox para o operador marcar
      doc.setDrawColor(100, 116, 139);
      doc.rect(margem + 265, y + 2, 5, 5);

      // Barra visual gráfica compacta
      const barraY = y + 7.5;
      const barraH = 4.5;
      const barraW = largUtil - 20; // 257mm
      doc.setFillColor(226, 232, 240);
      doc.rect(margem + 2, barraY, barraW, barraH, "F");

      let curX = margem + 2;
      const paleta = [
        [59, 130, 246], // blue
        [16, 185, 129], // emerald
        [245, 158, 11], // amber
        [139, 92, 246], // purple
        [244, 63, 94],  // rose
      ];

      padrao.itens.forEach((it, iIdx) => {
        for (let k = 0; k < it.quantidadePorBarra; k++) {
          const pedacoW = (it.comprimentoMm / padrao.comprimentoBarraMm) * barraW;
          const cor = paleta[iIdx % paleta.length];
          doc.setFillColor(cor[0], cor[1], cor[2]);
          doc.rect(curX, barraY, pedacoW, barraH, "F");
          doc.setDrawColor(255, 255, 255);
          doc.rect(curX, barraY, pedacoW, barraH, "S");

          if (pedacoW > 14) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(5);
            doc.setTextColor(255, 255, 255);
            doc.text(`OP ${it.opNumero}·${it.comprimentoMm}`, curX + pedacoW / 2, barraY + 3.2, { align: "center" });
          }
          curX += pedacoW;
        }
      });

      // Sobra gráfica
      const sobraW = (padrao.sobraMm / padrao.comprimentoBarraMm) * barraW;
      if (sobraW > 2) {
        doc.setFillColor(203, 213, 225);
        doc.rect(curX, barraY, sobraW, barraH, "F");
        if (sobraW > 10) {
          doc.setFontSize(4.5);
          doc.setTextColor(71, 85, 105);
          doc.text(`Sobra ${padrao.sobraCm}cm`, curX + sobraW / 2, barraY + 3.2, { align: "center" });
        }
      }

      y += altLinha;
    });

    // ROMANEIO DE CAIXAS POR OP PARA ESTE PERFIL
    checarEspaco(20);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text("ROMANEIO DE PEÇAS / DESTINO DAS CAIXAS:", margem, y);
    y += 3.5;

    doc.setFillColor(241, 245, 249);
    doc.rect(margem, y, largUtil, 5, "F");
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text("OP / LOTE", margem + 2, y + 3.5);
    doc.text("MODELO", margem + 40, y + 3.5);
    doc.text("CÓDIGO PEÇA", margem + 75, y + 3.5);
    doc.text("DESCRIÇÃO", margem + 115, y + 3.5);
    doc.text("COMPRIMENTO", margem + 195, y + 3.5, { align: "right" });
    doc.text("TOTAL CORTADO", margem + 230, y + 3.5, { align: "right" });
    doc.text("DESTINO FÍSICO", margem + 265, y + 3.5, { align: "center" });
    y += 5;

    perfil.romaneioOps.forEach((ro, rIdx) => {
      checarEspaco(5.5);
      if (rIdx % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(248, 250, 252);
      }
      doc.rect(margem, y, largUtil, 5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(`OP #${ro.opNumero} (${ro.lote})`, margem + 2, y + 3.5);

      doc.setFont("helvetica", "normal");
      doc.text(ro.modeloCodigo, margem + 40, y + 3.5);
      doc.setFont("helvetica", "bold");
      doc.text(ro.pecaCodigo, margem + 75, y + 3.5);

      doc.setFont("helvetica", "normal");
      doc.text(ro.pecaNome.substring(0, 45), margem + 115, y + 3.5);

      doc.text(`${ro.comprimentoMm} mm`, margem + 195, y + 3.5, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(2, 132, 199);
      doc.text(`${ro.quantidadeTotal} peças`, margem + 230, y + 3.5, { align: "right" });

      doc.setTextColor(15, 23, 42);
      doc.text(`Caixa OP #${ro.opNumero}`, margem + 265, y + 3.5, { align: "center" });

      doc.setDrawColor(226, 232, 240);
      doc.line(margem, y + 5, pagW - margem, y + 5);
      y += 5;
    });

    y += 8;
  });

  return new Uint8Array(doc.output("arraybuffer"));
}
