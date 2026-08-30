-- Rastreabilidade dos nests do Plasma. Cada programação pode concentrar
-- peças de várias OPs na mesma chapa e conserva os eventos e baixas reais.

CREATE TABLE "NestCorte" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "codigo" TEXT NOT NULL,
  "nomeArquivo" TEXT,
  "setorId" INTEGER NOT NULL,
  "maquinaId" INTEGER NOT NULL,
  "programadorId" INTEGER NOT NULL,
  "material" TEXT NOT NULL DEFAULT 'Aço',
  "espessuraMm" REAL,
  "larguraChapaMm" REAL,
  "alturaChapaMm" REAL,
  "pesoChapaKg" REAL,
  "pesoPecasKg" REAL,
  "pesoSobraKg" REAL,
  "aproveitamentoPct" REAL,
  "quantidadeChapas" INTEGER NOT NULL DEFAULT 1,
  "numeroPiercings" INTEGER,
  "comprimentoCorteMm" REAL,
  "comprimentoRapidoMm" REAL,
  "tempoCorteSegundos" INTEGER,
  "tempoDeslocamentoSegundos" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PROGRAMADO',
  "iniciadoEm" DATETIME,
  "finalizadoEm" DATETIME,
  "observacao" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NestCorte_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NestCorte_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NestCorte_programadorId_fkey" FOREIGN KEY ("programadorId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NestCorte_codigo_key" ON "NestCorte"("codigo");
CREATE INDEX "NestCorte_setorId_status_idx" ON "NestCorte"("setorId", "status");
CREATE INDEX "NestCorte_maquinaId_createdAt_idx" ON "NestCorte"("maquinaId", "createdAt");
CREATE INDEX "NestCorte_programadorId_createdAt_idx" ON "NestCorte"("programadorId", "createdAt");

CREATE TABLE "NestItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nestId" INTEGER NOT NULL,
  "opId" INTEGER NOT NULL,
  "pecaId" INTEGER NOT NULL,
  "quantidadePlanejada" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NestItem_nestId_fkey" FOREIGN KEY ("nestId") REFERENCES "NestCorte" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NestItem_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NestItem_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NestItem_nestId_opId_pecaId_key" ON "NestItem"("nestId", "opId", "pecaId");
CREATE INDEX "NestItem_opId_pecaId_idx" ON "NestItem"("opId", "pecaId");

CREATE TABLE "NestEvento" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nestId" INTEGER NOT NULL,
  "funcionarioId" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL,
  "descricao" TEXT,
  "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NestEvento_nestId_fkey" FOREIGN KEY ("nestId") REFERENCES "NestCorte" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NestEvento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "NestEvento_nestId_dataHora_idx" ON "NestEvento"("nestId", "dataHora");
CREATE INDEX "NestEvento_funcionarioId_dataHora_idx" ON "NestEvento"("funcionarioId", "dataHora");

CREATE TABLE "NestLancamento" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nestItemId" INTEGER NOT NULL,
  "funcionarioId" INTEGER NOT NULL,
  "apontamentoId" INTEGER,
  "tipo" TEXT NOT NULL DEFAULT 'PRODUCAO',
  "quantidadeBoa" INTEGER NOT NULL DEFAULT 0,
  "quantidadeRefugo" INTEGER NOT NULL DEFAULT 0,
  "motivoRefugo" TEXT,
  "observacao" TEXT,
  "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NestLancamento_nestItemId_fkey" FOREIGN KEY ("nestItemId") REFERENCES "NestItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NestLancamento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NestLancamento_apontamentoId_fkey" FOREIGN KEY ("apontamentoId") REFERENCES "Apontamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NestLancamento_apontamentoId_key" ON "NestLancamento"("apontamentoId");
CREATE INDEX "NestLancamento_nestItemId_dataHora_idx" ON "NestLancamento"("nestItemId", "dataHora");
CREATE INDEX "NestLancamento_funcionarioId_dataHora_idx" ON "NestLancamento"("funcionarioId", "dataHora");

PRAGMA optimize;
