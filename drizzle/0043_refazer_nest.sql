-- Permite criar uma nova programação a partir de um NEST anterior,
-- preservando o vínculo para rastreabilidade do retrabalho.
ALTER TABLE "NestCorte" ADD COLUMN "refeitoDeId" INTEGER;
CREATE INDEX "NestCorte_refeitoDeId_idx" ON "NestCorte"("refeitoDeId");
