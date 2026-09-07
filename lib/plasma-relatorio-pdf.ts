/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from "jspdf";
import type { DadosRelatorioPlasma, FiltrosRelatorioPlasma } from "@/lib/plasma-relatorio";
import { rotuloMaquina } from "@/lib/maquinas";
import { boasConferidas, perdasEfetivas, segundosEfetivos } from "@/lib/plasma-regras";

type Coluna = { titulo: string; largura: number; alinhamento?: "left" | "right" | "center" };

const NAVY: [number, number, number] = [15, 29, 52];
const INK: [number, number, number] = [31, 41, 55];
const MUTED: [number, number, number] = [91, 105, 125];
const LINE: [number, number, number] = [203, 213, 225];
const PALE: [number, number, number] = [244, 247, 250];
const CYAN: [number, number, number] = [8, 145, 178];

function limpar(valor: unknown) {
  return String(valor ?? "-")
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/·/g, "-");
}

function numero(valor: number) { return valor.toLocaleString("pt-BR"); }
function dataHora(valor: Date) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(valor); }
function duracao(segundos: number) { if (!segundos || segundos <= 0) return "-"; const horas = Math.floor(segundos / 3600); const minutos = Math.floor((segundos % 3600) / 60); const resto = segundos % 60; return [horas, minutos, resto].map((parte) => String(parte).padStart(2, "0")).join(":"); }
function conjunto(valor: Set<string>) { return [...valor].join(", ") || "-"; }
function filtroTexto(filtros: FiltrosRelatorioPlasma, dados: DadosRelatorioPlasma) {
  const maquinaId = Number(filtros.maquina);
  const operadorId = Number(filtros.operador);
  const maquina = dados.maquinas.find((item) => item.id === maquinaId);
  const operador = dados.operadores.find((item) => item.id === operadorId);
  const itens = [
    `Busca: ${filtros.busca || "todas"}`,
    `Período: ${filtros.dataInicio || "início"} a ${filtros.dataFim || "hoje"}`,
    `Máquina: ${maquina ? rotuloMaquina(maquina.codigo, maquina.nome) : "todas"}`,
    `Pessoa: ${operador?.nome || "todas"}`,
    `Situação: ${filtros.status || "todas"}`,
    `Tipo: ${filtros.tipo || "todos"}`,
  ];
  return itens.join("  |  ");
}

export function gerarPdfRelatorioPlasma(dados: DadosRelatorioPlasma, filtros: FiltrosRelatorioPlasma, logo?: Uint8Array) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
  const paginaW = 297;
  const paginaH = 210;
  const margem = 12;
  const largura = paginaW - margem * 2;
  const limiteY = paginaH - 13;
  let y = 35;

  function fonte(tamanho: number, negrito = false, cor: [number, number, number] = INK) { doc.setFont("helvetica", negrito ? "bold" : "normal"); doc.setFontSize(tamanho); doc.setTextColor(...cor); }
  function texto(valor: unknown, x: number, topo: number, tamanho = 7.2, negrito = false, cor: [number, number, number] = INK, alinhamento: "left" | "right" | "center" = "left", larguraTexto = 0) { fonte(tamanho, negrito, cor); const limpo = limpar(valor); const tamanhoEstimado = limpo.length * tamanho * 0.43; const posX = alinhamento === "right" && larguraTexto ? x + larguraTexto - tamanhoEstimado : alinhamento === "center" && larguraTexto ? x + (larguraTexto - tamanhoEstimado) / 2 : x; doc.text(limpo, Math.max(x, posX), topo, { align: alinhamento }); }
  function linhas(valor: unknown, larguraMax: number, tamanho = 7.2) { fonte(tamanho); return doc.splitTextToSize(limpar(valor), larguraMax) as string[]; }
  function rodape() { doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.line(margem, 198, paginaW - margem, 198); texto("ENGATES BRUCKE - Relatório de rastreabilidade do Plasma Chapa", margem, 204, 6.5, false, MUTED); texto(`Página ${doc.getNumberOfPages()}`, paginaW - margem, 204, 6.5, true, MUTED, "right"); }
  function cabecalho(primeira = false) { doc.setFillColor(...NAVY); doc.rect(0, 0, paginaW, primeira ? 27 : 19, "F"); if (logo) { const base64 = `data:image/png;base64,${Buffer.from(logo).toString("base64")}`; doc.setFillColor(255, 255, 255); doc.roundedRect(margem, 4, 28, 18, 1, 1, "F"); doc.addImage(base64, "PNG", margem + 2, 5.5, 24, 15, undefined, "FAST"); } else texto("BRUCKE", margem, 14, 10, true, [255, 255, 255]); texto("RELATÓRIO E RASTREABILIDADE - PLASMA CHAPA", 48, 11, 9.5, true, [255, 255, 255]); texto(primeira ? "Controle de programação, operação, perdas e liberação" : "Continuação do relatório", 48, 19, 7, false, [165, 180, 202]); texto(new Date().toLocaleString("pt-BR"), paginaW - margem, 11, 7, false, [191, 219, 254], "right"); }
  function novaPagina() { rodape(); doc.addPage(); cabecalho(false); y = 29; }
  function garantir(altura: number) { if (y + altura > limiteY) novaPagina(); }
  function secao(titulo: string) { garantir(12); fonte(9.5, true, NAVY); doc.text(limpar(titulo).toUpperCase(), margem, y); doc.setDrawColor(...CYAN); doc.setLineWidth(0.8); doc.line(margem, y + 3, margem + 30, y + 3); y += 8; }
  function tabela(titulo: string, colunas: Coluna[], linhasDados: string[][], paginaNova = false) {
    if (paginaNova) novaPagina();
    secao(titulo);
    const cabecalhoTabela = () => { garantir(8); doc.setFillColor(...NAVY); doc.rect(margem, y, largura, 8, "F"); let x = margem; colunas.forEach((coluna) => { texto(coluna.titulo, x + 2, y + 5.2, 6.1, true, [255, 255, 255], coluna.alinhamento ?? "left", coluna.largura - 4); x += coluna.largura; }); y += 8; };
    cabecalhoTabela();
    if (!linhasDados.length) { texto("Nenhum registro encontrado com os filtros selecionados.", margem + 3, y + 6, 7.5, false, MUTED); y += 13; return; }
    linhasDados.forEach((linha, indice) => { const quebradas = colunas.map((coluna, colunaIndex) => linhas(linha[colunaIndex] ?? "", coluna.largura - 4, 6.7)); const altura = Math.max(8, ...quebradas.map((item) => item.length * 3.4 + 3)); if (y + altura > limiteY) { novaPagina(); secao(`${titulo} - continuação`); cabecalhoTabela(); } if (indice % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(margem, y, largura, altura, "F"); } let x = margem; colunas.forEach((coluna, colunaIndex) => { quebradas[colunaIndex].forEach((linhaTexto, linhaIndex) => texto(linhaTexto, x + 2, y + 5.2 + linhaIndex * 3.4, 6.7, colunaIndex === 0, INK, coluna.alinhamento ?? "left", coluna.largura - 4)); x += coluna.largura; }); doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(margem, y + altura, paginaW - margem, y + altura); y += altura; }); y += 5;
  }

  doc.setProperties({ title: "Relatório de rastreabilidade - Plasma Chapa", subject: "Produção e rastreabilidade", author: "Engates Brucke" });
  cabecalho(true);
  secao("Filtros aplicados");
  garantir(14); doc.setFillColor(...PALE); doc.setDrawColor(...LINE); doc.roundedRect(margem, y - 5, largura, 14, 1, 1, "FD"); texto(filtroTexto(filtros, dados), margem + 4, y + 3, 7, false, INK); y += 16;

  secao("Indicadores gerais");
  const kpis: Array<[string, string]> = [["NESTs", numero(dados.nests.length)], ["OPs", numero(dados.totalOps)], ["Pessoas", numero(dados.pessoas.length)], ["Programadas", numero(dados.totalProgramado)], ["Boas declaradas", numero(dados.totalDeclarado)], ["Liberadas", numero(dados.totalLiberado)], ["Perdas", numero(dados.totalPerdas)], ["A conferir", numero(dados.aguardandoConferencia)]];
  const kpiW = (largura - 14) / 8;
  garantir(22); kpis.forEach(([rotulo, valor], indice) => { const x = margem + indice * (kpiW + 2); doc.setFillColor(...PALE); doc.setDrawColor(...LINE); doc.roundedRect(x, y, kpiW, 18, 1, 1, "FD"); texto(rotulo.toUpperCase(), x + 3, y + 6, 5.7, true, MUTED); texto(valor, x + 3, y + 14, 10, true, indice === 5 ? [4, 120, 87] : INK); }); y += 24;

  tabela("NESTs e ordens rastreadas", [
    { titulo: "NEST / situação", largura: 38 }, { titulo: "OPs e lotes", largura: 58 }, { titulo: "Máquina", largura: 38 }, { titulo: "Programador", largura: 36 }, { titulo: "Datas", largura: 42 }, { titulo: "Quantidades", largura: 48 }, { titulo: "Tempo", largura: largura - 260, alinhamento: "right" },
  ], dados.nests.map((nest) => { const lancamentos = nest.itens.flatMap((item: any) => item.lancamentos); const planejado = nest.itens.reduce((soma: number, item: any) => soma + item.quantidadePlanejada, 0); const declarado = lancamentos.reduce((soma: number, item: any) => soma + item.quantidadeBoa, 0); const liberado = lancamentos.reduce((soma: number, item: any) => soma + boasConferidas(item), 0); const perdas = lancamentos.reduce((soma: number, item: any) => soma + perdasEfetivas(item), 0); const ops = [...new Map(nest.itens.map((item: any) => [item.op.id, item.op])).values()].map((op: any) => `OP ${op.numeroSequencia}${op.lote ? ` / lote ${op.lote}` : ""}`).join(" | "); return [ `${nest.codigo} / ${nest.status}`, ops || "Sem OP", rotuloMaquina(nest.maquina.codigo, nest.maquina.nome), nest.programador.nome, `Criado ${dataHora(nest.createdAt)}\nInício ${nest.iniciadoEm ? dataHora(nest.iniciadoEm) : "-"}\nFim ${nest.finalizadoEm ? dataHora(nest.finalizadoEm) : "-"}`, `Plan. ${numero(planejado)}\nDecl. ${numero(declarado)}\nLib. ${numero(liberado)}\nPerd. ${numero(perdas)}`, duracao(nest.tempoCorteSegundos ?? segundosEfetivos(nest.eventos)) ]; }));

  tabela("Produção por OP e peça", [
    { titulo: "OP / lote", largura: 45 }, { titulo: "Peça", largura: 57 }, { titulo: "Programado", largura: 28, alinhamento: "right" }, { titulo: "Declarado", largura: 28, alinhamento: "right" }, { titulo: "Liberado", largura: 28, alinhamento: "right" }, { titulo: "Perdas", largura: 25, alinhamento: "right" }, { titulo: "A conferir", largura: 27, alinhamento: "right" }, { titulo: "NESTs / pessoas", largura: largura - 238 },
  ], dados.resumoOps.map((item) => [`OP ${item.opNumero}${item.lote ? ` / lote ${item.lote}` : ""}\n${item.modelo} - OP com ${numero(item.opQuantidade)} un.`, `${item.pecaCodigo}\n${item.pecaNome}`, numero(item.programado), numero(item.declarado), numero(item.liberado), numero(item.perdas), numero(item.aguardando), `NESTs: ${conjunto(item.nests)}\nOperadores: ${conjunto(item.operadores)}\nConferentes: ${conjunto(item.conferentes)}`]));

  tabela("Pessoas envolvidas", [
    { titulo: "Pessoa", largura: 54 }, { titulo: "Atuação", largura: 57 }, { titulo: "Programações", largura: 28, alinhamento: "right" }, { titulo: "Eventos", largura: 24, alinhamento: "right" }, { titulo: "Lançamentos", largura: 28, alinhamento: "right" }, { titulo: "Conferências", largura: 28, alinhamento: "right" }, { titulo: "Boas / perdas", largura: 30, alinhamento: "right" }, { titulo: "Liberadas", largura: largura - 249, alinhamento: "right" },
  ], dados.pessoas.map((item) => [item.nome, [...item.funcoes].join(" - "), numero(item.programacoes), numero(item.eventos), numero(item.lancamentos), numero(item.conferencias), `${numero(item.boasDeclaradas)} / ${numero(item.perdasDeclaradas)}`, numero(item.boasLiberadas)]), true);

  tabela("Linha do tempo completa", [
    { titulo: "Data e hora", largura: 25 }, { titulo: "Tipo", largura: 25 }, { titulo: "Ação / detalhe", largura: 58 }, { titulo: "Responsável", largura: 32 }, { titulo: "NEST / máquina", largura: 36 }, { titulo: "OP / peça", largura: 42 }, { titulo: "Boas / perdas", largura: 23, alinhamento: "right" }, { titulo: "Registro", largura: largura - 241 },
  ], dados.registrosFiltrados.map((registro) => [dataHora(registro.dataHora), registro.categoria, `${registro.acao}\n${registro.detalhe}`, registro.usuario, `${registro.nestCodigo}\n${registro.maquina}`, `${registro.op}\n${registro.peca}`, registro.boas === null ? "-" : `${numero(registro.boas)} / ${numero(registro.perdas ?? 0)}`, registro.apontamentoId ? `Apontamento #${registro.apontamentoId}` : registro.id]), true);

  rodape();
  return new Uint8Array(doc.output("arraybuffer"));
}
