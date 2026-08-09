-- Barras, cantoneiras e reforços pertencem aos setores de componentes.
-- Corrige roteiros antigos que ainda apontavam essas peças para Ponteira.

UPDATE "Peca"
SET "setorId" = CASE
  WHEN UPPER(COALESCE("tipoMaterial", '')) = 'REFORCO'
    THEN (SELECT "id" FROM "Setor" WHERE TRIM("nome") IN ('Componente Reforço', 'COMPONENTE REFORÇO', 'Componente Reforco', 'COMPONENTE REFORCO') LIMIT 1)
  WHEN UPPER(COALESCE("tipoMaterial", '')) IN ('BARRA_CHATA', 'CANTONEIRA')
    THEN (SELECT "id" FROM "Setor" WHERE TRIM("nome") IN ('Componente Barra Chata e Cantoneira', 'COMPONENTE BARRA CHATA E CANTONEIRA') LIMIT 1)
  ELSE "setorId"
END
WHERE UPPER(COALESCE("tipoMaterial", '')) IN ('REFORCO', 'BARRA_CHATA', 'CANTONEIRA');

UPDATE "PecaRoteiro"
SET "setorId" = CASE
  WHEN UPPER(COALESCE((SELECT "tipoMaterial" FROM "Peca" WHERE "Peca"."id" = "PecaRoteiro"."pecaId"), '')) = 'REFORCO'
    THEN (SELECT "id" FROM "Setor" WHERE TRIM("nome") IN ('Componente Reforço', 'COMPONENTE REFORÇO', 'Componente Reforco', 'COMPONENTE REFORCO') LIMIT 1)
  WHEN UPPER(COALESCE((SELECT "tipoMaterial" FROM "Peca" WHERE "Peca"."id" = "PecaRoteiro"."pecaId"), '')) IN ('BARRA_CHATA', 'CANTONEIRA')
    THEN (SELECT "id" FROM "Setor" WHERE TRIM("nome") IN ('Componente Barra Chata e Cantoneira', 'COMPONENTE BARRA CHATA E CANTONEIRA') LIMIT 1)
  ELSE "setorId"
END
WHERE "processo" <> 'AGRUPAR'
  AND UPPER(COALESCE((SELECT "tipoMaterial" FROM "Peca" WHERE "Peca"."id" = "PecaRoteiro"."pecaId"), '')) IN ('REFORCO', 'BARRA_CHATA', 'CANTONEIRA');

UPDATE "Apontamento"
SET "setorId" = CASE
  WHEN UPPER(COALESCE((SELECT "tipoMaterial" FROM "Peca" WHERE "Peca"."id" = "Apontamento"."pecaId"), '')) = 'REFORCO'
    THEN (SELECT "id" FROM "Setor" WHERE TRIM("nome") IN ('Componente Reforço', 'COMPONENTE REFORÇO', 'Componente Reforco', 'COMPONENTE REFORCO') LIMIT 1)
  WHEN UPPER(COALESCE((SELECT "tipoMaterial" FROM "Peca" WHERE "Peca"."id" = "Apontamento"."pecaId"), '')) IN ('BARRA_CHATA', 'CANTONEIRA')
    THEN (SELECT "id" FROM "Setor" WHERE TRIM("nome") IN ('Componente Barra Chata e Cantoneira', 'COMPONENTE BARRA CHATA E CANTONEIRA') LIMIT 1)
  ELSE "setorId"
END
WHERE ("processo" IS NULL OR "processo" <> 'AGRUPAR')
  AND UPPER(COALESCE((SELECT "tipoMaterial" FROM "Peca" WHERE "Peca"."id" = "Apontamento"."pecaId"), '')) IN ('REFORCO', 'BARRA_CHATA', 'CANTONEIRA');
