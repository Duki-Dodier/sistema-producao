export type DadosImportadosLibellula = {
  codigo?: string;
  nomeArquivo?: string;
  maquina?: string;
  setor?: "CHAPA" | "TUBO";
  material?: string;
  espessuraMm?: number;
  larguraChapaMm?: number;
  alturaChapaMm?: number;
  pesoChapaKg?: number;
  pesoPecasKg?: number;
  pesoSobraKg?: number;
  aproveitamentoPct?: number;
  quantidadeChapas?: number;
  numeroPiercings?: number;
  comprimentoCorteMm?: number;
  comprimentoRapidoMm?: number;
  tempoCorteSegundos?: number;
  tempoDeslocamentoSegundos?: number;
  pecas: Array<{ codigo: string; descricao: string; quantidade: number }>;
};

function numero(valor: string | undefined) {
  if (!valor) return undefined;
  const normalizado = valor.replace(/\./g, "").replace(",", ".");
  const resultado = Number(normalizado);
  return Number.isFinite(resultado) ? resultado : undefined;
}

function numeroSemSeparadorMilhar(valor: string | undefined) {
  if (!valor) return undefined;
  const resultado = Number(valor.replace(",", "."));
  return Number.isFinite(resultado) ? resultado : undefined;
}

function segundos(valor: string | undefined) {
  const partes = valor?.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!partes) return undefined;
  return Number(partes[1]) * 3600 + Number(partes[2]) * 60 + Number(partes[3]);
}

function somenteNumero(valor: string) {
  return /^\d+(?:[.,]\d+)?$/.test(valor) ? numeroSemSeparadorMilhar(valor) : undefined;
}

/**
 * Extrai os dados emitidos no relatório "Dados de Agrupamento" do Libellula.
 * O PDF pode variar entre máquinas/versões; os campos não encontrados ficam
 * vazios para o programador apenas conferir, sem bloquear a programação.
 */
export function extrairDadosLibellula(textoPdf: string): DadosImportadosLibellula {
  const linhas = textoPdf
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((linha) => linha.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const encontrarIndice = (padrao: RegExp) => linhas.findIndex((linha) => padrao.test(linha));
  const primeiro = (padrao: RegExp) => linhas.find((linha) => padrao.test(linha));
  const dados: DadosImportadosLibellula = { pecas: [] };

  const indiceTrabalho = encontrarIndice(/^Trabalho$/i);
  if (indiceTrabalho >= 0) dados.nomeArquivo = linhas[indiceTrabalho + 1];

  const indiceMaquina = encontrarIndice(/^M[aá]quina$/i);
  if (indiceMaquina > 0) dados.maquina = linhas[indiceMaquina - 1];
  if (dados.maquina) dados.setor = /tubo|tube|plt/i.test(dados.maquina) ? "TUBO" : "CHAPA";

  const indiceNomeArquivo = encontrarIndice(/^Nome do Arquivo$/i);
  const codigoPeloNome = indiceNomeArquivo >= 0
    ? linhas.slice(indiceNomeArquivo + 1, indiceNomeArquivo + 16).find((linha) => /^NEST[\w-]+$/i.test(linha))
    : undefined;
  const codigoPeloTrabalho = dados.nomeArquivo?.match(/\b(NEST[\w-]+)/i)?.[1];
  dados.codigo = codigoPeloNome ?? codigoPeloTrabalho ?? primeiro(/^NEST[\w-]+$/i);

  const indiceDimensao = linhas.findIndex((linha) => /^\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?$/i.test(linha));
  if (indiceDimensao >= 2) {
    const [largura, altura] = linhas[indiceDimensao].split(/\s*x\s*/i).map(numeroSemSeparadorMilhar);
    dados.larguraChapaMm = largura;
    dados.alturaChapaMm = altura;
    dados.espessuraMm = somenteNumero(linhas[indiceDimensao - 1]);
    const material = linhas[indiceDimensao - 2];
    if (/[A-Za-zÀ-ÿ]/.test(material)) dados.material = material;
  }

  const indiceValoresPeso = dados.codigo ? linhas.findIndex((linha) => linha === dados.codigo) : -1;
  if (indiceValoresPeso >= 0) {
    const valores = linhas
      .slice(indiceValoresPeso + 1, indiceValoresPeso + 12)
      .map(somenteNumero)
      .filter((valor): valor is number => valor !== undefined);
    dados.pesoChapaKg = valores[0];
    dados.pesoPecasKg = valores[1];
    dados.pesoSobraKg = valores[2];
    dados.aproveitamentoPct = valores.length ? valores[valores.length - 1] : undefined;
  }

  const horarios = linhas.filter((linha) => /^\d{2}:\d{2}:\d{2}$/.test(linha));
  if (horarios.length >= 3) {
    dados.tempoCorteSegundos = segundos(horarios[1]);
    dados.tempoDeslocamentoSegundos = segundos(horarios[2]);
  }

  const indiceComprimentos = linhas.findIndex((linha, indice) => {
    const atual = somenteNumero(linha);
    const proximo = somenteNumero(linhas[indice + 1]);
    return (atual ?? 0) > 1000 && (proximo ?? 0) > 1000;
  });
  if (indiceComprimentos >= 0) {
    dados.comprimentoCorteMm = somenteNumero(linhas[indiceComprimentos]);
    dados.comprimentoRapidoMm = somenteNumero(linhas[indiceComprimentos + 1]);
    dados.numeroPiercings = somenteNumero(linhas[indiceComprimentos + 3]);
  }

  const indiceNumeroCortes = encontrarIndice(/^N[uú]mero de corte/iu);
  if (indiceNumeroCortes >= 0) {
    dados.quantidadeChapas = linhas
      .slice(indiceNumeroCortes + 1, indiceNumeroCortes + 8)
      .map(somenteNumero)
      .find((valor) => Number.isInteger(valor) && (valor ?? 0) > 0);
  }

  for (let indice = 0; indice < linhas.length; indice++) {
    const linha = linhas[indice];
    if (!linha.includes("\\")) continue;
    const codigoBruto = linha.split("\\").at(-1)?.replace(/\s*-\s*$/, "").trim() ?? "";
    const codigo = codigoBruto.split(/\s+-\s+/)[0]?.trim();
    if (!codigo || !/[A-Za-z0-9]/.test(codigo)) continue;
    const descricao = [codigoBruto.replace(new RegExp(`^${codigo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "").replace(/^\s*-\s*/, ""), linhas[indice + 1] ?? ""]
      .filter(Boolean)
      .join(" ")
      .trim();
    const quantidade = linhas
      .slice(indice + 1, indice + 12)
      .map(somenteNumero)
      .find((valor) => Number.isInteger(valor) && (valor ?? 0) > 0 && (valor ?? 0) < 100000);
    if (quantidade) dados.pecas.push({ codigo, descricao: descricao || codigo, quantidade });
  }

  return dados;
}
