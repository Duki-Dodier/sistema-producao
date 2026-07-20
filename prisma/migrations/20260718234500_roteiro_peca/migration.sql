-- CreateTable
CREATE TABLE "PecaRoteiro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pecaId" INTEGER NOT NULL,
    "setorId" INTEGER NOT NULL,
    "processo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    CONSTRAINT "PecaRoteiro_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PecaRoteiro_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTable
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
    "roteiroEtapaId" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'OPERADOR',
    CONSTRAINT "Apontamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_roteiroEtapaId_fkey" FOREIGN KEY ("roteiroEtapaId") REFERENCES "PecaRoteiro" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Apontamento" ("abastecedor", "bancada", "dataHora", "id", "opId", "origem", "pecaId", "processo", "quantidadeBoa", "quantidadeRefugo", "quantidadeSoldada", "setorId", "soldador", "usuario")
SELECT "abastecedor", "bancada", "dataHora", "id", "opId", "origem", "pecaId", "processo", "quantidadeBoa", "quantidadeRefugo", "quantidadeSoldada", "setorId", "soldador", "usuario" FROM "Apontamento";
DROP TABLE "Apontamento";
ALTER TABLE "new_Apontamento" RENAME TO "Apontamento";
CREATE INDEX "Apontamento_opId_idx" ON "Apontamento"("opId");
CREATE INDEX "Apontamento_setorId_idx" ON "Apontamento"("setorId");
CREATE INDEX "Apontamento_pecaId_idx" ON "Apontamento"("pecaId");
CREATE INDEX "Apontamento_roteiroEtapaId_idx" ON "Apontamento"("roteiroEtapaId");
CREATE INDEX "Apontamento_setorId_dataHora_origem_idx" ON "Apontamento"("setorId", "dataHora", "origem");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "PecaRoteiro_pecaId_ordem_key" ON "PecaRoteiro"("pecaId", "ordem");
CREATE INDEX "PecaRoteiro_setorId_idx" ON "PecaRoteiro"("setorId");
CREATE INDEX "PecaRoteiro_pecaId_setorId_idx" ON "PecaRoteiro"("pecaId", "setorId");
