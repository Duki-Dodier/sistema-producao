-- Permissões de processo por funcionário para o apontamento via QR Code.
CREATE TABLE IF NOT EXISTS "FuncionarioProcesso" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funcionarioId" INTEGER NOT NULL,
    "processo" TEXT NOT NULL,
    CONSTRAINT "FuncionarioProcesso_funcionarioId_fkey"
      FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "FuncionarioProcesso_funcionarioId_processo_key"
  ON "FuncionarioProcesso"("funcionarioId", "processo");
CREATE INDEX IF NOT EXISTS "FuncionarioProcesso_processo_idx"
  ON "FuncionarioProcesso"("processo");

CREATE TABLE IF NOT EXISTS "OperadorSessao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funcionarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL UNIQUE,
    "expiraEm" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperadorSessao_funcionarioId_fkey"
      FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "OperadorSessao_funcionarioId_idx" ON "OperadorSessao"("funcionarioId");
CREATE INDEX IF NOT EXISTS "OperadorSessao_expiraEm_idx" ON "OperadorSessao"("expiraEm");

ALTER TABLE "Apontamento" ADD COLUMN "funcionarioId" INTEGER REFERENCES "Funcionario" ("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Apontamento_funcionarioId_idx" ON "Apontamento"("funcionarioId");

-- Mantém a operação dos funcionários já existentes. O administrador pode
-- reduzir a lista de cada operador na tela de Configurações.
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'PRODUCAO' FROM "Funcionario";
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'CORTE' FROM "Funcionario";
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'BATIDA' FROM "Funcionario";
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'FURACAO' FROM "Funcionario";
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'DOBRA' FROM "Funcionario";
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'AMASSAR' FROM "Funcionario";
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'CORTE_GRAU' FROM "Funcionario";
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'LIXAR' FROM "Funcionario";
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'SOLDAGEM' FROM "Funcionario";
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'AGRUPAR' FROM "Funcionario";
