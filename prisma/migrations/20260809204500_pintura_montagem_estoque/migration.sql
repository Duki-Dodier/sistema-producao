-- AlterTable
ALTER TABLE "Modelo" ADD COLUMN "linhaProduto" TEXT NOT NULL DEFAULT 'BRUCKE';

-- CreateTable
CREATE TABLE "FechamentoPintura" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" DATETIME NOT NULL,
    "quantidadeBrucke" INTEGER NOT NULL DEFAULT 0,
    "quantidadeReforcel" INTEGER NOT NULL DEFAULT 0,
    "refugoBrucke" INTEGER NOT NULL DEFAULT 0,
    "refugoReforcel" INTEGER NOT NULL DEFAULT 0,
    "usuario" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EntradaEstoque" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "usuario" TEXT NOT NULL,
    "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntradaEstoque_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoPintura_data_key" ON "FechamentoPintura"("data");

-- CreateIndex
CREATE INDEX "EntradaEstoque_opId_idx" ON "EntradaEstoque"("opId");

-- CreateIndex
CREATE INDEX "EntradaEstoque_dataHora_idx" ON "EntradaEstoque"("dataHora");
