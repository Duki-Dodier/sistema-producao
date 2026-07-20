-- CreateTable
CREATE TABLE "RecebimentoAgrupamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opId" INTEGER NOT NULL,
    "setorOrigemId" INTEGER NOT NULL,
    "recebidoPor" TEXT NOT NULL,
    "localizacao" TEXT NOT NULL,
    "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecebimentoAgrupamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecebimentoAgrupamento_setorOrigemId_fkey" FOREIGN KEY ("setorOrigemId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecebimentoAgrupamento_opId_setorOrigemId_key" ON "RecebimentoAgrupamento"("opId", "setorOrigemId");

-- CreateIndex
CREATE INDEX "RecebimentoAgrupamento_setorOrigemId_idx" ON "RecebimentoAgrupamento"("setorOrigemId");

-- CreateIndex
CREATE INDEX "RecebimentoAgrupamento_dataHora_idx" ON "RecebimentoAgrupamento"("dataHora");
