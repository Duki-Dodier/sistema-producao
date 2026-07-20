-- CreateTable
CREATE TABLE "ConferenciaPCP" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setorId" INTEGER NOT NULL,
    "data" DATETIME NOT NULL,
    "usuario" TEXT NOT NULL,
    "totalConferido" INTEGER NOT NULL,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConferenciaPCP_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConferenciaPCPItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conferenciaId" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ConferenciaPCPItem_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES "ConferenciaPCP" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Apontamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opId" INTEGER NOT NULL,
    "setorId" INTEGER NOT NULL,
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
    "origem" TEXT NOT NULL DEFAULT 'OPERADOR',
    CONSTRAINT "Apontamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Apontamento" ("abastecedor", "bancada", "dataHora", "id", "opId", "pecaId", "processo", "quantidadeBoa", "quantidadeRefugo", "quantidadeSoldada", "setorId", "soldador", "usuario") SELECT "abastecedor", "bancada", "dataHora", "id", "opId", "pecaId", "processo", "quantidadeBoa", "quantidadeRefugo", "quantidadeSoldada", "setorId", "soldador", "usuario" FROM "Apontamento";
DROP TABLE "Apontamento";
ALTER TABLE "new_Apontamento" RENAME TO "Apontamento";
CREATE INDEX "Apontamento_opId_idx" ON "Apontamento"("opId");
CREATE INDEX "Apontamento_setorId_idx" ON "Apontamento"("setorId");
CREATE INDEX "Apontamento_pecaId_idx" ON "Apontamento"("pecaId");
CREATE INDEX "Apontamento_setorId_dataHora_origem_idx" ON "Apontamento"("setorId", "dataHora", "origem");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ConferenciaPCP_data_idx" ON "ConferenciaPCP"("data");
CREATE UNIQUE INDEX "ConferenciaPCP_setorId_data_key" ON "ConferenciaPCP"("setorId", "data");
CREATE INDEX "ConferenciaPCPItem_conferenciaId_idx" ON "ConferenciaPCPItem"("conferenciaId");
CREATE UNIQUE INDEX "ConferenciaPCPItem_conferenciaId_categoria_key" ON "ConferenciaPCPItem"("conferenciaId", "categoria");
