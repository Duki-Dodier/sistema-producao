-- AlterTable
ALTER TABLE "Peca" ADD COLUMN "comprimentoMm" REAL;
ALTER TABLE "Peca" ADD COLUMN "espessuraMm" REAL;
ALTER TABLE "Peca" ADD COLUMN "medidaA" REAL;
ALTER TABLE "Peca" ADD COLUMN "medidaB" REAL;
ALTER TABLE "Peca" ADD COLUMN "tipoMaterial" TEXT;

-- CreateIndex
CREATE INDEX "Peca_tipoMaterial_medidaA_medidaB_idx" ON "Peca"("tipoMaterial", "medidaA", "medidaB");
