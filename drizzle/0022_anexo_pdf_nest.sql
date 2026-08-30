-- Preserva o PDF de agrupamento que originou o nest para auditoria e
-- permite que o programador envie o relatório do Libellula sem redigitar dados.

ALTER TABLE "NestCorte" ADD COLUMN "arquivoPdfUrl" TEXT;

PRAGMA optimize;
