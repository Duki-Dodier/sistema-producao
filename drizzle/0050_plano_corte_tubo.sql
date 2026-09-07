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
  FOREIGN KEY ("setorId") REFERENCES "Setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("criadoPorId") REFERENCES "Funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("concluidoPorId") REFERENCES "Funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("canceladoPorId") REFERENCES "Funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
--> statement-breakpoint
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
  FOREIGN KEY ("planoId") REFERENCES "PlanoCorteTubo"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE TABLE "PlanoCorteTuboItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "barraId" INTEGER NOT NULL,
  "opId" INTEGER NOT NULL,
  "pecaId" INTEGER NOT NULL,
  "ordem" INTEGER NOT NULL,
  "quantidade" INTEGER NOT NULL DEFAULT 1,
  "comprimentoUnitarioMm" REAL NOT NULL,
  "consumoTotalMm" REAL NOT NULL,
  FOREIGN KEY ("barraId") REFERENCES "PlanoCorteTuboBarra"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("opId") REFERENCES "OP"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("pecaId") REFERENCES "Peca"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
--> statement-breakpoint
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
  FOREIGN KEY ("planoOrigemId") REFERENCES "PlanoCorteTubo"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("planoReservaId") REFERENCES "PlanoCorteTubo"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("planoConsumoId") REFERENCES "PlanoCorteTubo"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "PlanoCorteTubo_codigo_key" ON "PlanoCorteTubo"("codigo");
--> statement-breakpoint
CREATE UNIQUE INDEX "PlanoCorteTubo_snapshotHash_key" ON "PlanoCorteTubo"("snapshotHash");
--> statement-breakpoint
CREATE INDEX "PlanoCorteTubo_setorId_status_idx" ON "PlanoCorteTubo"("setorId", "status");
--> statement-breakpoint
CREATE INDEX "PlanoCorteTubo_emitidoEm_idx" ON "PlanoCorteTubo"("emitidoEm");
--> statement-breakpoint
CREATE UNIQUE INDEX "PlanoCorteTuboBarra_planoId_ordem_key" ON "PlanoCorteTuboBarra"("planoId", "ordem");
--> statement-breakpoint
CREATE INDEX "PlanoCorteTuboBarra_planoId_idx" ON "PlanoCorteTuboBarra"("planoId");
--> statement-breakpoint
CREATE INDEX "PlanoCorteTuboBarra_sobraOrigemId_idx" ON "PlanoCorteTuboBarra"("sobraOrigemId");
--> statement-breakpoint
CREATE UNIQUE INDEX "PlanoCorteTuboItem_barraId_ordem_key" ON "PlanoCorteTuboItem"("barraId", "ordem");
--> statement-breakpoint
CREATE INDEX "PlanoCorteTuboItem_opId_idx" ON "PlanoCorteTuboItem"("opId");
--> statement-breakpoint
CREATE INDEX "PlanoCorteTuboItem_pecaId_idx" ON "PlanoCorteTuboItem"("pecaId");
--> statement-breakpoint
CREATE UNIQUE INDEX "SobraTubo_codigo_key" ON "SobraTubo"("codigo");
--> statement-breakpoint
CREATE INDEX "SobraTubo_status_perfil_idx" ON "SobraTubo"("status", "perfilA", "perfilB", "espessuraMm");
--> statement-breakpoint
CREATE INDEX "SobraTubo_planoOrigemId_idx" ON "SobraTubo"("planoOrigemId");
--> statement-breakpoint
CREATE INDEX "SobraTubo_planoReservaId_idx" ON "SobraTubo"("planoReservaId");
--> statement-breakpoint
CREATE INDEX "SobraTubo_planoConsumoId_idx" ON "SobraTubo"("planoConsumoId");
--> statement-breakpoint
PRAGMA optimize;
