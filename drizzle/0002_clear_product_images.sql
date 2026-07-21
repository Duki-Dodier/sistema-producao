-- Limpa as referências antigas para que as próximas imagens sejam cadastradas
-- somente pela estrutura organizada por modelo e peça no R2.
UPDATE "Modelo" SET "imagemUrl" = NULL WHERE "imagemUrl" IS NOT NULL;
UPDATE "Peca" SET "imagemUrl" = NULL WHERE "imagemUrl" IS NOT NULL;
