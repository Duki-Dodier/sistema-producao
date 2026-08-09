import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const arquivo = "backups/local-dev/mes-engates.sqlite";
if (!fs.existsSync(arquivo)) throw new Error("Backup local não encontrado.");

const db = new DatabaseSync(arquivo, { readOnly: true });
const integridade = db.prepare("PRAGMA integrity_check").get();
const tabelas = db
  .prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .get();
const temSessoes = db
  .prepare("SELECT 1 AS existe FROM sqlite_master WHERE type = 'table' AND name = 'OperadorSessao'")
  .get();
const sessoes = temSessoes
  ? db.prepare('SELECT COUNT(*) AS total FROM "OperadorSessao"').get()
  : { total: 0 };
db.close();

if (integridade.integrity_check !== "ok") throw new Error("Falha na verificação de integridade.");
if (sessoes.total !== 0) throw new Error("O backup ainda contém sessões de login.");
console.log(`Backup íntegro: ${tabelas.total} tabelas e nenhuma sessão ativa.`);
