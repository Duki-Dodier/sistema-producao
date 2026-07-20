-- AlterTable
ALTER TABLE "Setor" ADD COLUMN "diasUteisMes" INTEGER;

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "setorId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Funcionario_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    CONSTRAINT "Apontamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Apontamento" ("abastecedor", "bancada", "dataHora", "id", "opId", "pecaId", "quantidadeBoa", "quantidadeRefugo", "setorId", "soldador", "usuario") SELECT "abastecedor", "bancada", "dataHora", "id", "opId", "pecaId", "quantidadeBoa", "quantidadeRefugo", "setorId", "soldador", "usuario" FROM "Apontamento";
DROP TABLE "Apontamento";
ALTER TABLE "new_Apontamento" RENAME TO "Apontamento";
CREATE INDEX "Apontamento_opId_idx" ON "Apontamento"("opId");
CREATE INDEX "Apontamento_setorId_idx" ON "Apontamento"("setorId");
CREATE INDEX "Apontamento_pecaId_idx" ON "Apontamento"("pecaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Funcionario_setorId_idx" ON "Funcionario"("setorId");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_nome_setorId_key" ON "Funcionario"("nome", "setorId");
