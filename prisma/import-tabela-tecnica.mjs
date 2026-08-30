import fs from "node:fs/promises";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";

/**
 * Importa a planilha técnica exportada do Libellula para o catálogo do MES.
 *
 * Uso:
 *   node prisma/import-tabela-tecnica.mjs <arquivo.xlsx> [saida.sql]
 *
 * A planilha é tratada como cadastro de modelos/peças (não como OPs
 * históricas). Apenas linhas com STATUS=OK são importadas. O SQL gerado é
 * idempotente e pode ser aplicado com `wrangler d1 migrations apply DB --local`.
 */

const arquivo = process.argv[2];
if (!arquivo) throw new Error("Informe o caminho do XLSX.");
const saida = process.argv[3] ?? path.resolve("drizzle/0023_import_tabela_tecnica.sql");

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

function textoXml(xml) {
  return decodificarXml(String(xml ?? "").replace(/<[^>]+>/g, "")).trim();
}

function lerPlanilha(bytes) {
  const zip = unzipSync(bytes);
  const sharedXml = zip["xl/sharedStrings.xml"]
    ? strFromU8(zip["xl/sharedStrings.xml"])
    : "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, conteudo]) =>
    [...conteudo.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map(([, texto]) => decodificarXml(texto))
      .join(""),
  );

  const nomes = Object.keys(zip).filter((nome) => /^xl\/worksheets\/sheet\d+\.xml$/.test(nome));
  if (nomes.length === 0) throw new Error("A planilha não possui uma aba legível.");
  const sheetXml = strFromU8(zip[nomes[0]]);
  const linhas = [];
  for (const [, numero, rowXml] of sheetXml.matchAll(/<row\b[^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
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

function preencherLinhas(linhas) {
  let ultimoCodigo = "";
  let ultimaDescricao = "";
  return linhas
    .filter((row) => row.A != null && String(row.A).trim() !== "")
    .map((original) => {
      const row = { ...original };
      if (row.B && row.B !== ultimoCodigo) {
        ultimoCodigo = String(row.B).trim();
        ultimaDescricao = "";
      } else {
        row.B = ultimoCodigo;
      }
      if (row.C) ultimaDescricao = String(row.C).trim();
      else row.C = ultimaDescricao;
      return row;
    });
}

function numero(valor) {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return null;
  const tratado = bruto.includes(",") && bruto.includes(".")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : bruto.replace(",", ".");
  const n = Number(tratado);
  return Number.isFinite(n) ? n : null;
}

function inteiroPositivo(valor, fallback = 1) {
  const n = numero(valor);
  return n != null && n > 0 ? Math.max(1, Math.round(n)) : fallback;
}

function formatarNumero(valor) {
  if (valor == null) return "";
  return Number.isInteger(valor) ? String(valor) : String(Number(valor.toFixed(3)));
}

function medidaTexto({ comprimento, largura, altura, espessura }) {
  const c = formatarNumero(comprimento);
  const l = formatarNumero(largura);
  const a = formatarNumero(altura);
  const e = formatarNumero(espessura);
  if (l && a && e && c) return `${l} × ${a} × ${e} mm · comp. ${c} mm`;
  if (l && e && c) return `${l} × ${e} mm · comp. ${c} mm`;
  if (l && a && c) return `${l} × ${a} mm · comp. ${c} mm`;
  if (l && e) return `${l} × ${e} mm`;
  if (e) return `Espessura ${e} mm`;
  if (c) return `Comp. ${c} mm`;
  return null;
}

function sql(valor) {
  if (valor == null || valor === "") return "NULL";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "NULL";
  return `'${String(valor).replace(/'/g, "''")}'`;
}

function sanitizeSuffix(valor) {
  let sufixo = normalizar(valor)
    .replace(/\s*\/\s*/g, "-")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Corrige a grafia mais comum da planilha ("PL 1" -> "PL1").
  sufixo = sufixo.replace(/^(PL|TB|CB|BC|RCB|REF|CT|CANT|BCH|PF|RBC)-(\d+)$/, "$1$2");
  return sufixo || "OT";
}

function eSim(valor) {
  return normalizar(valor) === "SIM";
}

function ponteiraFinal(item) {
  if (!item.includes("PONTEIRA") && !item.includes("CABECA REMOVIVEL")) return false;
  // Chapa/tubo/reforço que fazem parte de uma ponteira continuam sendo
  // componentes do plasma, não a ponteira soldada pronta.
  return !/(CHAPA|PLASMA|TUBO|REFORCO|BARRA|CANTONEIRA|PERFIL|CORTE)/.test(item);
}

function materialDaLinha(row, modelType) {
  const item = normalizar(row.E);
  const setor = normalizar(row.F);
  const final = ponteiraFinal(item);
  if (final) return "PONTEIRA";
  if (setor.includes("REFORCO") || /REFORCO|REF DE CABECA|CABECA ENGATE/.test(item)) return "REFORCO";
  if (setor.includes("PLASMA TUBO") || setor === "TUBO PLASMA") {
    return /TUBO|ANEL/.test(item) ? "TUBO" : "PLASMA";
  }
  if (setor.includes("PLASMA") || /PLASMA|CORTE PLASMA|CENTRAL RETANGULAR/.test(item)) return "PLASMA";
  if (setor.includes("TUBO") || /^(TUBO|TUBINHO|TUBO MACICO)/.test(item)) return "TUBO";
  if (setor.includes("CANTONEIRA") || item.includes("CANTONEIRA")) return "CANTONEIRA";
  if (setor.includes("BARRA CHATA") || setor.includes("COMPONENTE") || /BARRA CHATA|B\.CHATA|B CHATA/.test(item)) return "BARRA_CHATA";
  if (setor.includes("ACESSORIO")) return "OUTRO";
  if (item.includes("PERFIL")) return "CANTONEIRA";
  // Uma descrição removível sem setor (caso comum nas linhas antigas) ainda
  // deve ser ponteira se o item for claramente a peça pronta.
  if (modelType === "REMOVIVEL" && final) return "PONTEIRA";
  return "OUTRO";
}

function setorDaLinha(row, material, modelType) {
  const item = normalizar(row.E);
  const setor = normalizar(row.F);
  const final = material === "PONTEIRA";
  const removivel = final && (item.includes("PONTEIRA REM") || item.includes("CABECA REMOVIVEL") || setor.includes("PLASMA TUBO") || (modelType === "REMOVIVEL" && !item.includes("FIXA")));
  if (setor.includes("PLASMA TUBO") || setor === "TUBO PLASMA") return 4; // Tubos e ponteiras cortados na máquina Plasma Tubo.
  if (removivel) return 4;
  if (final) return 8;
  if (material === "PLASMA") return 3;
  if (material === "TUBO") return 2;
  if (material === "REFORCO") return 10;
  if (material === "BARRA_CHATA" || material === "CANTONEIRA") return 5;
  return 11;
}

function processosDaLinha(row, material, modelType) {
  const item = normalizar(row.E);
  const final = material === "PONTEIRA";
  const removivel = final && (item.includes("PONTEIRA REM") || item.includes("CABECA REMOVIVEL") || normalizar(row.F).includes("PLASMA TUBO") || (modelType === "REMOVIVEL" && !item.includes("FIXA")));
  const selecionados = new Set();
  if (eSim(row.L) || eSim(row.M) || eSim(row.R) || eSim(row.S)) selecionados.add("CORTE");
  if (eSim(row.N)) selecionados.add("DOBRA");
  if (eSim(row.O)) selecionados.add("FURACAO");
  if (eSim(row.P)) selecionados.add("CORTE_GRAU");
  if (eSim(row.Q)) selecionados.add("AMASSAR");

  if (final) {
    // Regra de negócio: toda ponteira recebe acabamento e soldagem. A
    // soldagem aqui é um PROCESSO; o setor SOLDA continua sendo outra etapa.
    selecionados.add("CORTE");
    selecionados.add("LIXAR");
    selecionados.add("SOLDAGEM");
    if (!removivel) selecionados.add("BATIDA");
  }

  const ordem = ["CORTE", "BATIDA", "FURACAO", "DOBRA", "AMASSAR", "CORTE_GRAU", "LIXAR", "SOLDAGEM"];
  return ordem.filter((processo) => selecionados.has(processo));
}

function sufixoBase(material) {
  return {
    PLASMA: "PL",
    TUBO: "TB",
    PONTEIRA: "CB",
    REFORCO: "RCB",
    BARRA_CHATA: "BC",
    CANTONEIRA: "CT",
    OUTRO: "OT",
  }[material] ?? "OT";
}

function codigoPeca(modelo, row, material, usados, sequencias) {
  const explicito = String(row.D ?? "").trim();
  let base = explicito ? sanitizeSuffix(explicito) : "";
  // Algumas versões da tabela repetem o próprio código do modelo na coluna
  // "Código peça" (por exemplo, MI1004AMI1004APL1). O SKU deve conter o
  // código do modelo apenas uma vez: MI1004A-PL1.
  if (base) {
    const modeloSanitizado = sanitizeSuffix(modelo);
    if (base === modeloSanitizado) base = "";
    else if (base.startsWith(`${modeloSanitizado}-`)) base = base.slice(modeloSanitizado.length + 1);
    else if (base.startsWith(modeloSanitizado) && base.length > modeloSanitizado.length) base = base.slice(modeloSanitizado.length);
  }
  if (!base) base = (() => {
    const chave = sufixoBase(material);
    const atual = (sequencias.get(chave) ?? 0) + 1;
    sequencias.set(chave, atual);
    return `${chave}${atual}`;
  })();
  let sufixo = base;
  let n = 2;
  while (usados.has(sufixo)) sufixo = `${base}-${n++}`;
  usados.add(sufixo);
  return `${modelo}-${sufixo}`;
}

function tipoModelo(descricao, rows) {
  const texto = normalizar(descricao);
  if (texto.includes("REMOV") || texto.includes("REM..") || rows.some((row) => {
    const item = normalizar(row.E);
    return ponteiraFinal(item) && (item.includes("REM") || item.includes("CABECA REMOVIVEL"));
  })) return "REMOVIVEL";
  return "FIXO";
}

function curvaModelo(codigo) {
  const prefixo = String(codigo).match(/^[A-Z]+/)?.[0] ?? "";
  return { AD: "C", BM: "B", FT: "A" }[prefixo] ?? "A";
}

function linhaProduto(descricao) {
  return normalizar(descricao).includes("REFORCEL") ? "REFORCEL" : "BRUCKE";
}

function ehRemovivel(row, modelType) {
  const item = normalizar(row.E);
  return row.material === "PONTEIRA" && (item.includes("PONTEIRA REM") || item.includes("CABECA REMOVIVEL") || normalizar(row.F).includes("PLASMA TUBO") || (modelType === "REMOVIVEL" && !item.includes("FIXA")));
}

function rotasPeca(row, setores) {
  const agrupamento = 9;
  const principal = row.setorId;
  const etapas = [];
  const adicionar = (setorId, processo) => {
    if (setorId != null) etapas.push({ setorId, processo });
  };
  if (row.material === "PONTEIRA" && row.removivel) {
    adicionar(4, "CORTE");
    adicionar(8, "SOLDAGEM");
    adicionar(8, "LIXAR");
  } else if (row.material === "PONTEIRA") {
    adicionar(8, "CORTE");
    adicionar(8, "BATIDA");
    adicionar(8, "LIXAR");
    adicionar(8, "SOLDAGEM");
  } else if (row.material === "PLASMA") {
    adicionar(principal, "CORTE");
    if (row.processos.includes("DOBRA")) adicionar(5, "DOBRA");
  } else {
    for (const processo of row.processos) adicionar(principal, processo);
  }
  adicionar(agrupamento, "AGRUPAR");
  return etapas.map((etapa, indice) => ({ ...etapa, ordem: indice + 1 }));
}

function emBlocos(items, tamanho = 250) {
  const blocos = [];
  for (let i = 0; i < items.length; i += tamanho) blocos.push(items.slice(i, i + tamanho));
  return blocos;
}

const linhas = preencherLinhas(lerPlanilha(new Uint8Array(await fs.readFile(arquivo))));
const dados = linhas.filter((row) => normalizar(row.A) === "OK" && row.B);
if (dados.length === 0) throw new Error("Nenhuma linha com STATUS=OK foi encontrada.");

const porModelo = new Map();
for (const row of dados) {
  const codigo = String(row.B).trim();
  if (!porModelo.has(codigo)) porModelo.set(codigo, []);
  porModelo.get(codigo).push(row);
}

const modelos = [];
const pecas = [];
const modeloPecas = [];
const modeloRotas = new Map();
const mapaSetorOrdem = new Map([[1, 9], [2, 1], [3, 2], [4, 3], [5, 4], [6, 11], [7, 10], [8, 6], [9, 8], [10, 5], [11, 7]]);

for (const [codigo, linhasModelo] of porModelo) {
  const descricao = linhasModelo.map((row) => String(row.C ?? "").trim()).find(Boolean) ?? "";
  const tipo = tipoModelo(descricao, linhasModelo);
  modelos.push({ codigo, nome: descricao || `Modelo importado ${codigo}`, curva: curvaModelo(codigo), tipo, linhaProduto: linhaProduto(descricao) });
  const usados = new Set();
  const sequencias = new Map();
  const setores = new Set([1, 7, 6, 9]);
  for (const original of linhasModelo) {
    const material = materialDaLinha(original, tipo);
    const setorId = setorDaLinha(original, material, tipo);
    const processos = processosDaLinha(original, material, tipo);
    const peca = {
      modeloCodigo: codigo,
      codigo: codigoPeca(codigo, original, material, usados, sequencias),
      nome: String(original.E ?? "").trim() || `Peça ${codigo}`,
      setorId,
      material,
      modelType: tipo,
      removivel: material === "PONTEIRA" && (normalizar(original.E).includes("PONTEIRA REM") || normalizar(original.E).includes("CABECA REMOVIVEL") || normalizar(original.F).includes("PLASMA TUBO") || (tipo === "REMOVIVEL" && !normalizar(original.E).includes("FIXA"))),
      comprimento: numero(original.G),
      largura: numero(original.H),
      altura: numero(original.I),
      espessura: numero(original.J),
      quantidade: inteiroPositivo(original.K),
      processos,
      medida: medidaTexto({ comprimento: numero(original.G), largura: numero(original.H), altura: numero(original.I), espessura: numero(original.J) }),
      observacao: `Importado da tabela técnica · linha ${original._r} · setor informado: ${String(original.F ?? "").trim() || "não informado"}`,
    };
    pecas.push(peca);
    // A peça PONTEIRA Rem. é o tubo fêmea do próprio engate e permanece na
    // BOM. O conjunto intercambiável (tubo + chapa) é controlado à parte na
    // página Ponteiras.
    modeloPecas.push({ modeloCodigo: codigo, pecaCodigo: peca.codigo, quantidade: peca.quantidade });
    setores.add(setorId);
  }
  const setoresOrdenados = [...setores].sort((a, b) => (mapaSetorOrdem.get(a) ?? 99) - (mapaSetorOrdem.get(b) ?? 99));
  modeloRotas.set(codigo, setoresOrdenados.map((setorId, indice) => ({ setorId, ordem: indice + 1 })));
}

const comandos = [
  "-- Importação da TABELA TECNICA ENGATES.xlsx (somente STATUS=OK).",
  "-- SKUs: <código do engate>-<código da peça>; códigos ausentes recebem sufixo determinístico.",
  "-- SOLDAGEM é processo da ponteira; o setor SOLDA permanece uma etapa final distinta.",
  "PRAGMA foreign_keys = ON;",
];

for (const modelo of modelos) {
  comandos.push(`INSERT INTO "Modelo" ("codigo", "nome", "curva", "tipo", "linhaProduto", "createdAt", "updatedAt") VALUES (${sql(modelo.codigo)}, ${sql(modelo.nome)}, ${sql(modelo.curva)}, ${sql(modelo.tipo)}, ${sql(modelo.linhaProduto)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT("codigo") DO UPDATE SET "nome"=excluded."nome", "tipo"=excluded."tipo", "linhaProduto"=excluded."linhaProduto", "updatedAt"=CURRENT_TIMESTAMP;`);
}

for (const bloco of emBlocos(modelos.map((modelo) => modelo.codigo))) {
  const lista = bloco.map(sql).join(",");
  comandos.push(`DELETE FROM "ConfiguracaoPonteira" WHERE "modeloId" IN (SELECT "id" FROM "Modelo" WHERE "codigo" IN (${lista}));`);
  comandos.push(`DELETE FROM "ModeloPeca" WHERE "modeloId" IN (SELECT "id" FROM "Modelo" WHERE "codigo" IN (${lista}));`);
  comandos.push(`DELETE FROM "ModeloRoteiro" WHERE "modeloId" IN (SELECT "id" FROM "Modelo" WHERE "codigo" IN (${lista}));`);
}

for (const peca of pecas) {
  comandos.push(`INSERT INTO "Peca" ("codigo", "nome", "medida", "setorId", "tipoMaterial", "medidaA", "medidaB", "espessuraMm", "comprimentoMm", "processos", "observacao", "createdAt", "updatedAt") VALUES (${sql(peca.codigo)}, ${sql(peca.nome)}, ${sql(peca.medida)}, ${peca.setorId}, ${sql(peca.material)}, ${sql(peca.largura)}, ${sql(peca.altura)}, ${sql(peca.espessura)}, ${sql(peca.comprimento)}, ${sql(peca.processos.join(","))}, ${sql(peca.observacao)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT("codigo") DO UPDATE SET "nome"=excluded."nome", "medida"=excluded."medida", "setorId"=excluded."setorId", "tipoMaterial"=excluded."tipoMaterial", "medidaA"=excluded."medidaA", "medidaB"=excluded."medidaB", "espessuraMm"=excluded."espessuraMm", "comprimentoMm"=excluded."comprimentoMm", "processos"=excluded."processos", "observacao"=excluded."observacao", "updatedAt"=CURRENT_TIMESTAMP;`);
}

for (const bloco of emBlocos(pecas.map((peca) => peca.codigo))) {
  const lista = bloco.map(sql).join(",");
  comandos.push(`DELETE FROM "PecaRoteiro" WHERE "pecaId" IN (SELECT "id" FROM "Peca" WHERE "codigo" IN (${lista}));`);
}

for (const link of modeloPecas) {
  comandos.push(`INSERT INTO "ModeloPeca" ("modeloId", "pecaId", "quantidadeNecessaria") SELECT m."id", p."id", ${link.quantidade} FROM "Modelo" m, "Peca" p WHERE m."codigo"=${sql(link.modeloCodigo)} AND p."codigo"=${sql(link.pecaCodigo)};`);
}

for (const peca of pecas) {
  for (const etapa of rotasPeca(peca, mapaSetorOrdem)) {
    comandos.push(`INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem") SELECT p."id", ${etapa.setorId}, ${sql(etapa.processo)}, ${etapa.ordem} FROM "Peca" p WHERE p."codigo"=${sql(peca.codigo)};`);
  }
}

for (const [modeloCodigo, etapas] of modeloRotas) {
  for (const etapa of etapas) {
    comandos.push(`INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem") SELECT m."id", ${etapa.setorId}, ${etapa.ordem} FROM "Modelo" m WHERE m."codigo"=${sql(modeloCodigo)};`);
  }
}

// Os componentes intercambiáveis da ponteira removível ficam fora da BOM.
// O tubo fêmea "PONTEIRA Rem." continua na BOM do engate. O vínculo com
// PON-TB-* e PON-CH-* é criado pela migração de controle de ponteiras, depois
// que o tamanho (P/M/G) é importado da planilha comercial.

await fs.writeFile(saida, `${comandos.join("\n")}\n`, "utf8");
console.log(JSON.stringify({
  arquivo: path.resolve(arquivo),
  saida: path.resolve(saida),
  linhasOk: dados.length,
  modelos: modelos.length,
  pecas: pecas.length,
  modeloPecas: modeloPecas.length,
  modeloRotas: [...modeloRotas.values()].reduce((soma, itens) => soma + itens.length, 0),
  ponteiras: pecas.filter((peca) => peca.material === "PONTEIRA").length,
  ponteirasRemoviveis: pecas.filter((peca) => peca.material === "PONTEIRA" && peca.removivel).length,
}, null, 2));
