-- Pequena e média usam o mesmo tubo. Consolida qualquer saldo antigo da
-- linha Média na linha Pequena, que passa a ser o saldo único PON-TB-PM.
UPDATE "EstoquePonteira"
SET "tubosCortados" = "tubosCortados" + COALESCE((
  SELECT "tubosCortados" FROM "EstoquePonteira" WHERE "tamanho" = 'MEDIA'
), 0),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "tamanho" = 'PEQUENA';

UPDATE "EstoquePonteira"
SET "tubosCortados" = 0,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "tamanho" = 'MEDIA';
