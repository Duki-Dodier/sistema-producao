import fs from "node:fs/promises";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";

/**
 * Importa os dados da aba principal da planilha de estoque/regulador.
 *
 * A coluna "Estoque Regulador" da planilha alimenta Modelo.estoqueMinimo,
 * que é o campo usado pelo MES para o limite de estoque. A coluna
 * "Ponteira" atualiza o tipo somente quando contém Fixo ou Rem.; valores
 * #N/A, vazios e "Ponteira" ficam preservados para revisão manual.
 *
 * Uso:
 *   node prisma/import-reguladores.mjs <arquivo.xlsx> [saida.sql]
 */

const arquivo = process.argv[2];
if (!arquivo) throw new Error("Informe o caminho do XLSX.");
const saida = process.argv[3] ?? path.resolve("drizzle/0026_importar_estoque_regulador.sql");

const normalizar = (valor) => String(valor ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleUpperCase("pt-BR")
  .trim();

const decodificarXml = (texto) => String(texto ?? "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

const textoXml = (texto) => decodificarXml(String(texto ?? "").replace(/<[^>]+>/g, "")).trim();

function lerPrimeiraAba(bytes) {
  const zip = unzipSync(bytes);
  const sharedXml = zip["xl/sharedStrings.xml"]
    ? strFromU8(zip["xl/sharedStrings.xml"])
    : "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, conteudo]) =>
    [...conteudo.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map(([, texto]) => decodificarXml(texto))
      .join(""),
  );
  const nome = Object.keys(zip).find((item) => item === "xl/worksheets/sheet1.xml");
  if (!nome) throw new Error("A planilha não possui a aba principal esperada.");
  const xml = strFromU8(zip[nome]);
  const linhas = [];
  for (const [, numero, rowXml] of xml.matchAll(/<row\b[^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = { _r: Number(numero) };
    for (const [, ref, attrs, body = ""] of rowXml.matchAll(/<c\b[^>]*?r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tipo = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? "";
      const valorBruto = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
      const inline = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? "";
      row[ref] = tipo === "s"
        ? (shared[Number(valorBruto)] ?? "")
        : inline
          ? decodificarXml(inline)
          : textoXml(valorBruto);
    }
    if (Object.keys(row).length > 1) linhas.push(row);
  }
  return linhas;
}

function numero(valor) {
  const bruto = String(valor ?? "").trim();
  if (!bruto || bruto.startsWith("#")) return null;
  const tratado = bruto.includes(",") && bruto.includes(".")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : bruto.replace(",", ".");
  const n = Number(tratado);
  return Number.isFinite(n) ? n : null;
}

function literalSql(valor) {
  return `'${String(valor).replace(/'/g, "''")}'`;
}

const linhas = lerPrimeiraAba(await fs.readFile(arquivo));
const codigoValido = /^[A-Z]{2,6}\d{3,5}[A-Z]*$/i;
const tipoValido = (valor) => {
  const tipo = normalizar(valor).replace(/\.$/, "");
  if (tipo === "FIXO") return "FIXO";
  if (tipo === "REM" || tipo === "REMOVIVEL") return "REMOVIVEL";
  return null;
};

const registros = linhas
  .filter((row) => row._r >= 3 && codigoValido.test(String(row.B ?? "").trim()))
  .map((row) => {
    const codigo = String(row.B).trim().toUpperCase();
    const estoqueBruto = numero(row.G);
    return {
      linha: row._r,
      codigo,
      estoqueMinimo: estoqueBruto == null ? null : Math.max(0, Math.round(estoqueBruto)),
      tipo: tipoValido(row.O),
      tipoOriginal: String(row.O ?? "").trim(),
    };
  });

const unicos = new Map();
for (const registro of registros) {
  if (unicos.has(registro.codigo)) {
    throw new Error(`Código duplicado na planilha: ${registro.codigo}`);
  }
  unicos.set(registro.codigo, registro);
}

const sql = [
  "-- Importação da planilha de estoque regulador.",
  `-- Fonte: ${path.basename(arquivo)} | Aba: sheet1 | Cabeçalho: linha 2 | Gerado em ${new Date().toISOString()}`,
  "-- Valores decimais foram arredondados para unidades inteiras, conforme o cadastro do MES.",
  "",
];
let atualizaEstoque = 0;
let atualizaTipo = 0;
for (const registro of unicos.values()) {
  const campos = [];
  if (registro.estoqueMinimo != null) {
    campos.push(`\"estoqueMinimo\" = ${registro.estoqueMinimo}`);
    atualizaEstoque++;
  }
  if (registro.tipo) {
    campos.push(`\"tipo\" = ${literalSql(registro.tipo)}`);
    atualizaTipo++;
  }
  if (campos.length === 0) continue;
  campos.push("\"updatedAt\" = CURRENT_TIMESTAMP");
  sql.push(`UPDATE \"Modelo\" SET ${campos.join(", ")} WHERE \"codigo\" = ${literalSql(registro.codigo)};`);
}

await fs.writeFile(saida, `${sql.join("\n")}\n`, "utf8");
const semTipo = registros.filter((item) => !item.tipo).map((item) => `${item.codigo} (${item.tipoOriginal || "vazio"})`);
console.log(JSON.stringify({
  saida,
  registros: registros.length,
  atualizaEstoque,
  atualizaTipo,
  semTipo: semTipo.length,
  exemplosSemTipo: semTipo.slice(0, 20),
}, null, 2));
