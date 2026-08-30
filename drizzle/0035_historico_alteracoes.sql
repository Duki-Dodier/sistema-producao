-- Histórico geral de alterações para rastreabilidade do MES.
CREATE TABLE IF NOT EXISTS "HistoricoAlteracao" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "entidade" TEXT NOT NULL,
  "entidadeId" INTEGER,
  "acao" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "usuario" TEXT NOT NULL,
  "dadosAntes" TEXT,
  "dadosDepois" TEXT,
  "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "HistoricoAlteracao_entidade_entidadeId_idx" ON "HistoricoAlteracao" ("entidade", "entidadeId");
CREATE INDEX IF NOT EXISTS "HistoricoAlteracao_dataHora_idx" ON "HistoricoAlteracao" ("dataHora");
