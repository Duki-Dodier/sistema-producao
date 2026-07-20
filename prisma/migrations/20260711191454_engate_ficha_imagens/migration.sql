-- AlterTable
ALTER TABLE "Apontamento" ADD COLUMN "abastecedor" TEXT;

-- AlterTable
ALTER TABLE "Modelo" ADD COLUMN "estoqueMinimo" INTEGER;
ALTER TABLE "Modelo" ADD COLUMN "imagemUrl" TEXT;
ALTER TABLE "Modelo" ADD COLUMN "nome" TEXT;

-- AlterTable
ALTER TABLE "Peca" ADD COLUMN "imagemUrl" TEXT;
