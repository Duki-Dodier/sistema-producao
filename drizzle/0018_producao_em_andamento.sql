-- Ciclo do operador: inicia uma peça, acompanha o tempo e finaliza o apontamento.
-- O registro é removido somente depois que o Apontamento é criado.

CREATE TABLE "ProducaoEmAndamento" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "opId" INTEGER NOT NULL,
  "setorId" INTEGER NOT NULL,
  "funcionarioId" INTEGER NOT NULL,
  "pecaId" INTEGER,
  "roteiroEtapaId" INTEGER,
  "processo" TEXT,
  "maquinaId" INTEGER NOT NULL,
  "usuario" TEXT NOT NULL,
  "iniciadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quantidadePrevista" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProducaoEmAndamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProducaoEmAndamento_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProducaoEmAndamento_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProducaoEmAndamento_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProducaoEmAndamento_roteiroEtapaId_fkey" FOREIGN KEY ("roteiroEtapaId") REFERENCES "PecaRoteiro" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProducaoEmAndamento_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ProducaoEmAndamento_funcionarioId_iniciadoEm_idx" ON "ProducaoEmAndamento"("funcionarioId", "iniciadoEm");
CREATE INDEX "ProducaoEmAndamento_setorId_iniciadoEm_idx" ON "ProducaoEmAndamento"("setorId", "iniciadoEm");
CREATE INDEX "ProducaoEmAndamento_opId_idx" ON "ProducaoEmAndamento"("opId");
