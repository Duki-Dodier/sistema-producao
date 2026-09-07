PRAGMA foreign_keys=OFF;

CREATE TABLE "PlanoCorteTubo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "setorId" INTEGER NOT NULL,
    "maquinaId" INTEGER,
    "criadoPorId" INTEGER NOT NULL,
    "concluidoPorId" INTEGER,
    "canceladoPorId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'EMITIDO',
    "comprimentoBarraMm" REAL NOT NULL DEFAULT 6000,
    "perdaCorteMm" REAL NOT NULL,
    "margemInicialMm" REAL NOT NULL,
    "margemFinalMm" REAL NOT NULL,
    "minimoSobraMm" REAL NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "totalBarrasNovas" INTEGER NOT NULL DEFAULT 0,
    "totalSobrasUsadas" INTEGER NOT NULL DEFAULT 0,
    "totalPecas" INTEGER NOT NULL DEFAULT 0,
    "comprimentoPecasMm" REAL NOT NULL DEFAULT 0,
    "perdaCortesTotalMm" REAL NOT NULL DEFAULT 0,
    "sobraReutilizavelPrevistaMm" REAL NOT NULL DEFAULT 0,
    "desperdicioPrevistoMm" REAL NOT NULL DEFAULT 0,
    "aproveitamentoPct" REAL NOT NULL DEFAULT 0,
    "emitidoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" DATETIME,
    "canceladoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanoCorteTubo_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanoCorteTubo_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlanoCorteTubo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanoCorteTubo_concluidoPorId_fkey" FOREIGN KEY ("concluidoPorId") REFERENCES "Funcionario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlanoCorteTubo_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "Funcionario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PlanoCorteTuboBarra" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "planoId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "perfilA" REAL NOT NULL,
    "perfilB" REAL,
    "espessuraMm" REAL NOT NULL,
    "origem" TEXT NOT NULL,
    "comprimentoOrigemMm" REAL NOT NULL,
    "sobraOrigemId" INTEGER,
    "comprimentoConsumidoMm" REAL NOT NULL,
    "sobraPrevistaMm" REAL NOT NULL,
    "sobraRealMm" REAL,
    "aproveitamentoPct" REAL NOT NULL,
    CONSTRAINT "PlanoCorteTuboBarra_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "PlanoCorteTubo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PlanoCorteTuboItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barraId" INTEGER NOT NULL,
    "opId" INTEGER NOT NULL,
    "pecaId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "comprimentoUnitarioMm" REAL NOT NULL,
    "consumoTotalMm" REAL NOT NULL,
    CONSTRAINT "PlanoCorteTuboItem_barraId_fkey" FOREIGN KEY ("barraId") REFERENCES "PlanoCorteTuboBarra" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanoCorteTuboItem_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanoCorteTuboItem_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SobraTubo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "perfilA" REAL NOT NULL,
    "perfilB" REAL,
    "espessuraMm" REAL NOT NULL,
    "comprimentoMm" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISPONIVEL',
    "planoOrigemId" INTEGER,
    "planoReservaId" INTEGER,
    "planoConsumoId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SobraTubo_planoOrigemId_fkey" FOREIGN KEY ("planoOrigemId") REFERENCES "PlanoCorteTubo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SobraTubo_planoReservaId_fkey" FOREIGN KEY ("planoReservaId") REFERENCES "PlanoCorteTubo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SobraTubo_planoConsumoId_fkey" FOREIGN KEY ("planoConsumoId") REFERENCES "PlanoCorteTubo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlanoCorteTubo_codigo_key" ON "PlanoCorteTubo"("codigo");
CREATE UNIQUE INDEX "PlanoCorteTubo_snapshotHash_key" ON "PlanoCorteTubo"("snapshotHash");
CREATE INDEX "PlanoCorteTubo_setorId_status_idx" ON "PlanoCorteTubo"("setorId", "status");
CREATE INDEX "PlanoCorteTubo_emitidoEm_idx" ON "PlanoCorteTubo"("emitidoEm");
CREATE UNIQUE INDEX "PlanoCorteTuboBarra_planoId_ordem_key" ON "PlanoCorteTuboBarra"("planoId", "ordem");
CREATE INDEX "PlanoCorteTuboBarra_planoId_idx" ON "PlanoCorteTuboBarra"("planoId");
CREATE INDEX "PlanoCorteTuboBarra_sobraOrigemId_idx" ON "PlanoCorteTuboBarra"("sobraOrigemId");
CREATE UNIQUE INDEX "PlanoCorteTuboItem_barraId_ordem_key" ON "PlanoCorteTuboItem"("barraId", "ordem");
CREATE INDEX "PlanoCorteTuboItem_opId_idx" ON "PlanoCorteTuboItem"("opId");
CREATE INDEX "PlanoCorteTuboItem_pecaId_idx" ON "PlanoCorteTuboItem"("pecaId");
CREATE UNIQUE INDEX "SobraTubo_codigo_key" ON "SobraTubo"("codigo");
CREATE INDEX "SobraTubo_status_perfilA_perfilB_espessuraMm_idx" ON "SobraTubo"("status", "perfilA", "perfilB", "espessuraMm");
CREATE INDEX "SobraTubo_planoOrigemId_idx" ON "SobraTubo"("planoOrigemId");
CREATE INDEX "SobraTubo_planoReservaId_idx" ON "SobraTubo"("planoReservaId");
CREATE INDEX "SobraTubo_planoConsumoId_idx" ON "SobraTubo"("planoConsumoId");

PRAGMA foreign_keys=ON;
