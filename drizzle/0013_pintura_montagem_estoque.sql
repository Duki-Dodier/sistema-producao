ALTER TABLE "Modelo" ADD COLUMN "linhaProduto" TEXT NOT NULL DEFAULT 'BRUCKE';

CREATE TABLE "FechamentoPintura" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "data" DATETIME NOT NULL,
  "quantidadeBrucke" INTEGER NOT NULL DEFAULT 0,
  "quantidadeReforcel" INTEGER NOT NULL DEFAULT 0,
  "refugoBrucke" INTEGER NOT NULL DEFAULT 0,
  "refugoReforcel" INTEGER NOT NULL DEFAULT 0,
  "usuario" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "FechamentoPintura_data_key" ON "FechamentoPintura" ("data");

CREATE TABLE "EntradaEstoque" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "opId" INTEGER NOT NULL,
  "quantidade" INTEGER NOT NULL,
  "usuario" TEXT NOT NULL,
  "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("opId") REFERENCES "OP"("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX "EntradaEstoque_opId_idx" ON "EntradaEstoque" ("opId");
CREATE INDEX "EntradaEstoque_dataHora_idx" ON "EntradaEstoque" ("dataHora");
