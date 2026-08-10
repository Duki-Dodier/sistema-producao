-- Sincroniza os campos já usados pelo aplicativo com o histórico de migrações.
ALTER TABLE "OP" ADD COLUMN "lote" TEXT;
ALTER TABLE "OP" ADD COLUMN "previsaoEntrega" DATETIME;
ALTER TABLE "Peca" ADD COLUMN "observacao" TEXT;

CREATE TABLE "AjusteApontamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "apontamentoId" INTEGER NOT NULL,
    "valorAnterior" INTEGER NOT NULL,
    "valorNovo" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorizadoPorId" INTEGER NOT NULL,
    "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AjusteApontamento_apontamentoId_fkey" FOREIGN KEY ("apontamentoId") REFERENCES "Apontamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AjusteApontamento_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PecaCurva" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pecaId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "medidaCm" REAL,
    "anguloGraus" REAL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "maquina" TEXT,
    CONSTRAINT "PecaCurva_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Funcionario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "setorId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pin" TEXT,
    "papel" TEXT NOT NULL DEFAULT 'OPERADOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Funcionario_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Funcionario" ("ativo", "createdAt", "id", "nome", "setorId", "updatedAt") SELECT "ativo", "createdAt", "id", "nome", "setorId", "updatedAt" FROM "Funcionario";
DROP TABLE "Funcionario";
ALTER TABLE "new_Funcionario" RENAME TO "Funcionario";
CREATE INDEX "Funcionario_setorId_idx" ON "Funcionario"("setorId");
CREATE UNIQUE INDEX "Funcionario_nome_setorId_key" ON "Funcionario"("nome", "setorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE INDEX "AjusteApontamento_apontamentoId_idx" ON "AjusteApontamento"("apontamentoId");
CREATE INDEX "AjusteApontamento_autorizadoPorId_idx" ON "AjusteApontamento"("autorizadoPorId");
CREATE UNIQUE INDEX "PecaCurva_pecaId_ordem_key" ON "PecaCurva"("pecaId", "ordem");
CREATE UNIQUE INDEX "OP_lote_key" ON "OP"("lote");
