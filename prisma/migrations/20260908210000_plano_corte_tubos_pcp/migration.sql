DROP TABLE IF EXISTS "SobraTubo";
DROP TABLE IF EXISTS "PlanoCorteTuboItem";
DROP TABLE IF EXISTS "PlanoCorteTuboBarra";
DROP TABLE IF EXISTS "PlanoCorteTubo";

CREATE TABLE "PlanoCorteTubo" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "codigo" TEXT NOT NULL,
  "criadoPorId" INTEGER NOT NULL,
  "comprimentoBarraMm" REAL NOT NULL DEFAULT 6000,
  "perdaCorteMm" REAL NOT NULL DEFAULT 3,
  "refileInicialMm" REAL NOT NULL DEFAULT 10,
  "snapshotHash" TEXT NOT NULL,
  "totalOps" INTEGER NOT NULL DEFAULT 0,
  "totalPadroes" INTEGER NOT NULL DEFAULT 0,
  "totalBarras" INTEGER NOT NULL DEFAULT 0,
  "totalPecas" INTEGER NOT NULL DEFAULT 0,
  "comprimentoPecasMm" REAL NOT NULL DEFAULT 0,
  "perdaCortesTotalMm" REAL NOT NULL DEFAULT 0,
  "refileTotalMm" REAL NOT NULL DEFAULT 0,
  "sobraTotalMm" REAL NOT NULL DEFAULT 0,
  "aproveitamentoPct" REAL NOT NULL DEFAULT 0,
  "emitidoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanoCorteTubo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PlanoCorteTuboPadrao" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "planoId" INTEGER NOT NULL,
  "ordem" INTEGER NOT NULL,
  "codigo" TEXT NOT NULL,
  "perfilMm" REAL NOT NULL,
  "espessuraMm" REAL NOT NULL,
  "repeticoes" INTEGER NOT NULL,
  "comprimentoBarraMm" REAL NOT NULL DEFAULT 6000,
  "comprimentoPecasPorBarraMm" REAL NOT NULL,
  "perdaCortesPorBarraMm" REAL NOT NULL,
  "refileInicialMm" REAL NOT NULL,
  "sobraPorBarraMm" REAL NOT NULL,
  "aproveitamentoPct" REAL NOT NULL,
  CONSTRAINT "PlanoCorteTuboPadrao_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "PlanoCorteTubo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PlanoCorteTuboItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "padraoId" INTEGER NOT NULL,
  "opId" INTEGER,
  "pecaId" INTEGER,
  "ordem" INTEGER NOT NULL,
  "opNumero" INTEGER NOT NULL,
  "lote" TEXT NOT NULL,
  "modeloCodigo" TEXT NOT NULL,
  "pecaCodigo" TEXT NOT NULL,
  "pecaNome" TEXT NOT NULL,
  "quantidadePorBarra" INTEGER NOT NULL,
  "quantidadeTotal" INTEGER NOT NULL,
  "comprimentoUnitarioMm" REAL NOT NULL,
  CONSTRAINT "PlanoCorteTuboItem_padraoId_fkey" FOREIGN KEY ("padraoId") REFERENCES "PlanoCorteTuboPadrao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlanoCorteTuboItem_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PlanoCorteTuboItem_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlanoCorteTubo_codigo_key" ON "PlanoCorteTubo"("codigo");
CREATE INDEX "PlanoCorteTubo_emitidoEm_idx" ON "PlanoCorteTubo"("emitidoEm");
CREATE INDEX "PlanoCorteTubo_criadoPorId_emitidoEm_idx" ON "PlanoCorteTubo"("criadoPorId", "emitidoEm");
CREATE UNIQUE INDEX "PlanoCorteTuboPadrao_planoId_ordem_key" ON "PlanoCorteTuboPadrao"("planoId", "ordem");
CREATE UNIQUE INDEX "PlanoCorteTuboPadrao_planoId_codigo_key" ON "PlanoCorteTuboPadrao"("planoId", "codigo");
CREATE INDEX "PlanoCorteTuboPadrao_planoId_idx" ON "PlanoCorteTuboPadrao"("planoId");
CREATE UNIQUE INDEX "PlanoCorteTuboItem_padraoId_ordem_key" ON "PlanoCorteTuboItem"("padraoId", "ordem");
CREATE INDEX "PlanoCorteTuboItem_opId_idx" ON "PlanoCorteTuboItem"("opId");
CREATE INDEX "PlanoCorteTuboItem_pecaId_idx" ON "PlanoCorteTuboItem"("pecaId");
