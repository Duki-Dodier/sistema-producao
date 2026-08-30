CREATE TABLE "HistoricoAlteracao" (
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

CREATE INDEX "HistoricoAlteracao_entidade_entidadeId_idx" ON "HistoricoAlteracao"("entidade", "entidadeId");
CREATE INDEX "HistoricoAlteracao_dataHora_idx" ON "HistoricoAlteracao"("dataHora");
