-- Estrutura da conferência do Plasma. As regras operacionais ficam nas ações
-- do sistema para que a migração permaneça compatível com o executor D1.
ALTER TABLE "NestLancamento" ADD COLUMN "conferenteId" INTEGER REFERENCES "Funcionario"("id");
--> statement-breakpoint
ALTER TABLE "NestLancamento" ADD COLUMN "conferidoEm" DATETIME;
--> statement-breakpoint
ALTER TABLE "NestLancamento" ADD COLUMN "quantidadeConferidaBoa" INTEGER;
--> statement-breakpoint
ALTER TABLE "NestLancamento" ADD COLUMN "quantidadeConferidaRefugo" INTEGER;
--> statement-breakpoint
ALTER TABLE "NestLancamento" ADD COLUMN "motivoConferencia" TEXT;
--> statement-breakpoint
CREATE INDEX "NestLancamento_pendente_idx" ON "NestLancamento"("nestItemId") WHERE "apontamentoId" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "Funcionario_conferente_plasma_unico_idx" ON "Funcionario"("papel") WHERE "papel" = 'CONFERENTE' AND "ativo" = 1;
