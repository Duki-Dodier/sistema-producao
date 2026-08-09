import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const raiz = process.cwd();
const pastaD1 = path.join(
  raiz,
  ".wrangler",
  "state",
  "v3",
  "d1",
  "miniflare-D1DatabaseObject",
);
const pastaDestino = path.join(raiz, "backups", "local-dev");
const destinoBanco = path.join(pastaDestino, "mes-engates.sqlite");

const bancos = fs
  .readdirSync(pastaD1, { withFileTypes: true })
  .filter((item) => item.isFile() && item.name.endsWith(".sqlite") && item.name !== "metadata.sqlite")
  .map((item) => path.join(pastaD1, item.name));

if (bancos.length !== 1) {
  throw new Error(`Esperado um banco local do MES; encontrados: ${bancos.length}.`);
}
if (fs.existsSync(destinoBanco)) {
  throw new Error("O backup já existe. Mova ou remova o arquivo antes de gerar uma nova cópia.");
}

fs.mkdirSync(pastaDestino, { recursive: true });
const origem = new DatabaseSync(bancos[0]);
origem.exec("PRAGMA wal_checkpoint(FULL)");
origem.exec(`VACUUM INTO '${destinoBanco.replaceAll("'", "''")}'`);
origem.close();

const backup = new DatabaseSync(destinoBanco);
const temSessoes = backup
  .prepare("SELECT 1 AS existe FROM sqlite_master WHERE type = 'table' AND name = 'OperadorSessao'")
  .get();
if (temSessoes) backup.exec('DELETE FROM "OperadorSessao"; VACUUM;');
backup.close();

console.log(`Backup criado em ${path.relative(raiz, destinoBanco)}.`);
