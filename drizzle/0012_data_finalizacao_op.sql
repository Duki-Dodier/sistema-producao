-- Registra a data em que a OP foi marcada como concluída.
ALTER TABLE "OP" ADD COLUMN "dataFinalizacao" DATETIME;

-- Mantém uma referência para OPs antigas já concluídas.
UPDATE "OP"
SET "dataFinalizacao" = "updatedAt"
WHERE "status" = 'CONCLUIDA'
  AND "dataFinalizacao" IS NULL;
