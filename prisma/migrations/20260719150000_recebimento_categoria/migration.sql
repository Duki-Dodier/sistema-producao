-- RedefineTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecebimentoAgrupamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opId" INTEGER NOT NULL,
    "setorOrigemId" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "recebidoPor" TEXT NOT NULL,
    "localizacao" TEXT NOT NULL,
    "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecebimentoAgrupamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecebimentoAgrupamento_setorOrigemId_fkey" FOREIGN KEY ("setorOrigemId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RecebimentoAgrupamento" ("dataHora", "id", "localizacao", "opId", "recebidoPor", "setorOrigemId", "categoria")
SELECT
    "dataHora",
    "id",
    "localizacao",
    "opId",
    "recebidoPor",
    "setorOrigemId",
    CASE
        WHEN UPPER((SELECT "nome" FROM "Setor" WHERE "id" = "RecebimentoAgrupamento"."setorOrigemId")) = 'PONTEIRA' THEN 'PONTEIRA'
        ELSE 'SETOR:' || "setorOrigemId"
    END
FROM "RecebimentoAgrupamento";
DROP TABLE "RecebimentoAgrupamento";
ALTER TABLE "new_RecebimentoAgrupamento" RENAME TO "RecebimentoAgrupamento";
CREATE UNIQUE INDEX "RecebimentoAgrupamento_opId_categoria_key" ON "RecebimentoAgrupamento"("opId", "categoria");
CREATE INDEX "RecebimentoAgrupamento_setorOrigemId_idx" ON "RecebimentoAgrupamento"("setorOrigemId");
CREATE INDEX "RecebimentoAgrupamento_dataHora_idx" ON "RecebimentoAgrupamento"("dataHora");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
