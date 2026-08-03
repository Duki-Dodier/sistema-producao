-- Permissões explícitas de processo por funcionário.
CREATE TABLE "FuncionarioProcesso" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funcionarioId" INTEGER NOT NULL,
    "processo" TEXT NOT NULL,
    CONSTRAINT "FuncionarioProcesso_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FuncionarioProcesso_funcionarioId_processo_key" ON "FuncionarioProcesso"("funcionarioId", "processo");
CREATE INDEX "FuncionarioProcesso_processo_idx" ON "FuncionarioProcesso"("processo");

CREATE TABLE "OperadorSessao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "funcionarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperadorSessao_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OperadorSessao_tokenHash_key" ON "OperadorSessao"("tokenHash");
CREATE INDEX "OperadorSessao_funcionarioId_idx" ON "OperadorSessao"("funcionarioId");
CREATE INDEX "OperadorSessao_expiraEm_idx" ON "OperadorSessao"("expiraEm");

-- Mantém os apontamentos existentes e passa a registrar o funcionário quando
-- o lançamento vier pelo kiosk autenticado. Registros antigos continuam válidos.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Apontamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opId" INTEGER NOT NULL,
    "setorId" INTEGER NOT NULL,
    "funcionarioId" INTEGER,
    "usuario" TEXT NOT NULL,
    "quantidadeBoa" INTEGER NOT NULL DEFAULT 0,
    "quantidadeRefugo" INTEGER NOT NULL DEFAULT 0,
    "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldador" TEXT,
    "bancada" TEXT,
    "abastecedor" TEXT,
    "quantidadeSoldada" INTEGER NOT NULL DEFAULT 0,
    "pecaId" INTEGER,
    "processo" TEXT,
    "roteiroEtapaId" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'OPERADOR',
    CONSTRAINT "Apontamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_roteiroEtapaId_fkey" FOREIGN KEY ("roteiroEtapaId") REFERENCES "PecaRoteiro" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Apontamento" ("abastecedor", "bancada", "dataHora", "id", "opId", "origem", "pecaId", "processo", "quantidadeBoa", "quantidadeRefugo", "quantidadeSoldada", "roteiroEtapaId", "setorId", "soldador", "usuario")
SELECT "abastecedor", "bancada", "dataHora", "id", "opId", "origem", "pecaId", "processo", "quantidadeBoa", "quantidadeRefugo", "quantidadeSoldada", "roteiroEtapaId", "setorId", "soldador", "usuario" FROM "Apontamento";
DROP TABLE "Apontamento";
ALTER TABLE "new_Apontamento" RENAME TO "Apontamento";
CREATE INDEX "Apontamento_opId_idx" ON "Apontamento"("opId");
CREATE INDEX "Apontamento_setorId_idx" ON "Apontamento"("setorId");
CREATE INDEX "Apontamento_funcionarioId_idx" ON "Apontamento"("funcionarioId");
CREATE INDEX "Apontamento_pecaId_idx" ON "Apontamento"("pecaId");
CREATE INDEX "Apontamento_roteiroEtapaId_idx" ON "Apontamento"("roteiroEtapaId");
CREATE INDEX "Apontamento_setorId_dataHora_origem_idx" ON "Apontamento"("setorId", "dataHora", "origem");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Funcionários já existentes continuam operando após a migração. O cadastro
-- pode restringir cada um removendo os processos que não executa.
INSERT INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'PRODUCAO' FROM "Funcionario";
INSERT INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'CORTE' FROM "Funcionario";
INSERT INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'BATIDA' FROM "Funcionario";
INSERT INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'FURACAO' FROM "Funcionario";
INSERT INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'DOBRA' FROM "Funcionario";
INSERT INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'AMASSAR' FROM "Funcionario";
INSERT INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'CORTE_GRAU' FROM "Funcionario";
INSERT INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'LIXAR' FROM "Funcionario";
INSERT INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'SOLDAGEM' FROM "Funcionario";
INSERT INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'AGRUPAR' FROM "Funcionario";
