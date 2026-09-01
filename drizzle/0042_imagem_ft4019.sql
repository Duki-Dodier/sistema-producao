-- Mantém a referência visual do FT4019 disponível no site mesmo quando o
-- objeto original ainda não foi sincronizado no armazenamento de uploads.
UPDATE "Modelo"
SET "imagemUrl" = '/modelos/FT4019.png'
WHERE "codigo" = 'FT4019'
  AND ("imagemUrl" IS NULL OR "imagemUrl" = '');
