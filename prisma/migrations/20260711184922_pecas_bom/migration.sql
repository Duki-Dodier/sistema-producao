-- CreateTable
CREATE TABLE "Peca" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "medida" TEXT,
    "setorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Peca_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModeloPeca" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modeloId" INTEGER NOT NULL,
    "pecaId" INTEGER NOT NULL,
    "quantidadeNecessaria" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ModeloPeca_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "Modelo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModeloPeca_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "pecaId" INTEGER,
    CONSTRAINT "Apontamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Apontamento" ("bancada", "dataHora", "id", "opId", "quantidadeBoa", "quantidadeRefugo", "setorId", "soldador", "usuario") SELECT "bancada", "dataHora", "id", "opId", "quantidadeBoa", "quantidadeRefugo", "setorId", "soldador", "usuario" FROM "Apontamento";
DROP TABLE "Apontamento";
ALTER TABLE "new_Apontamento" RENAME TO "Apontamento";
CREATE INDEX "Apontamento_opId_idx" ON "Apontamento"("opId");
CREATE INDEX "Apontamento_setorId_idx" ON "Apontamento"("setorId");
CREATE INDEX "Apontamento_pecaId_idx" ON "Apontamento"("pecaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Peca_codigo_key" ON "Peca"("codigo");

-- CreateIndex
CREATE INDEX "Peca_setorId_idx" ON "Peca"("setorId");

-- CreateIndex
CREATE INDEX "ModeloPeca_pecaId_idx" ON "ModeloPeca"("pecaId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloPeca_modeloId_pecaId_key" ON "ModeloPeca"("modeloId", "pecaId");
