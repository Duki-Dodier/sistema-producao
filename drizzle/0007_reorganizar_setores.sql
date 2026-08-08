-- Estrutura oficial da fábrica: setores de preparação, Agrupamento e linha final.
-- A migração preserva os IDs e históricos já existentes.

UPDATE "Setor"
SET "nome" = 'Componente Barra Chata e Cantoneira'
WHERE UPPER(TRIM("nome")) IN ('COMPONENTES E ACESSÓRIOS', 'COMPONENTES E ACESSORIOS', 'COMPONENTE');

INSERT OR IGNORE INTO "Setor" ("nome", "ordemPadrao", "createdAt", "updatedAt")
VALUES ('Componente Reforço', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO "Setor" ("nome", "ordemPadrao", "createdAt", "updatedAt")
VALUES ('Acessórios', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "Setor"
SET "ordemPadrao" = CASE
  WHEN UPPER(TRIM("nome")) = 'TUBO' THEN 1
  WHEN UPPER(TRIM("nome")) = 'PLASMA CHAPA' THEN 2
  WHEN UPPER(TRIM("nome")) = 'PLASMA TUBO' THEN 3
  WHEN UPPER(TRIM("nome")) = 'COMPONENTE BARRA CHATA E CANTONEIRA' THEN 4
  WHEN UPPER(TRIM("nome")) = 'COMPONENTE REFORÇO' OR UPPER(TRIM("nome")) = 'COMPONENTE REFORCO' THEN 5
  WHEN UPPER(TRIM("nome")) = 'PONTEIRA' THEN 6
  WHEN UPPER(TRIM("nome")) = 'ACESSÓRIOS' OR UPPER(TRIM("nome")) = 'ACESSORIOS' THEN 7
  WHEN UPPER(TRIM("nome")) = 'AGRUPAMENTO' THEN 8
  WHEN UPPER(TRIM("nome")) = 'SOLDA' THEN 9
  WHEN UPPER(TRIM("nome")) = 'PINTURA' THEN 10
  WHEN UPPER(TRIM("nome")) = 'MONTAGEM' THEN 11
  ELSE "ordemPadrao"
END;

-- Separa as peças antigas de Componentes e Acessórios pelo material.
UPDATE "Peca"
SET "setorId" = CASE
  WHEN UPPER(COALESCE("tipoMaterial", '')) = 'REFORCO' THEN (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Reforço')
  WHEN UPPER(COALESCE("tipoMaterial", '')) IN ('BARRA_CHATA', 'CANTONEIRA') THEN (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira')
  ELSE (SELECT "id" FROM "Setor" WHERE "nome" = 'Acessórios')
END
WHERE "setorId" = (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira')
  AND UPPER(COALESCE("tipoMaterial", '')) NOT IN ('BARRA_CHATA', 'CANTONEIRA');

-- Mantém o roteiro real de cada peça no novo setor correspondente.
UPDATE "PecaRoteiro"
SET "setorId" = CASE
  WHEN UPPER(COALESCE((SELECT "tipoMaterial" FROM "Peca" WHERE "Peca"."id" = "PecaRoteiro"."pecaId"), '')) = 'REFORCO' THEN (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Reforço')
  WHEN UPPER(COALESCE((SELECT "tipoMaterial" FROM "Peca" WHERE "Peca"."id" = "PecaRoteiro"."pecaId"), '')) IN ('BARRA_CHATA', 'CANTONEIRA') THEN (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira')
  ELSE (SELECT "id" FROM "Setor" WHERE "nome" = 'Acessórios')
END
WHERE "setorId" = (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira');

-- Históricos sem peça identificada continuam no setor antigo, agora renomeado.
UPDATE "Apontamento"
SET "setorId" = CASE
  WHEN UPPER(COALESCE((SELECT "tipoMaterial" FROM "Peca" WHERE "Peca"."id" = "Apontamento"."pecaId"), '')) = 'REFORCO' THEN (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Reforço')
  WHEN UPPER(COALESCE((SELECT "tipoMaterial" FROM "Peca" WHERE "Peca"."id" = "Apontamento"."pecaId"), '')) IN ('BARRA_CHATA', 'CANTONEIRA') THEN (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira')
  ELSE "setorId"
END
WHERE "setorId" = (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira');

-- Funcionários, conferências e recebimentos antigos permanecem no setor principal
-- de barras/cantoneiras; o administrador pode redistribuí-los depois.
UPDATE "Funcionario"
SET "setorId" = (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira')
WHERE "setorId" = (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira');

UPDATE "ConferenciaPCP"
SET "setorId" = (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira')
WHERE "setorId" = (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira');

UPDATE "RecebimentoAgrupamento"
SET "setorOrigemId" = (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira')
WHERE "setorOrigemId" = (SELECT "id" FROM "Setor" WHERE "nome" = 'Componente Barra Chata e Cantoneira');

-- Recalcula o roteiro de cada modelo pela união do roteiro anterior, das peças
-- vinculadas e dos roteiros internos, evitando duplicidade de setores.
CREATE TABLE "_modelo_roteiro_reorg" AS
SELECT DISTINCT "modeloId", "setorId"
FROM "ModeloRoteiro";

INSERT INTO "_modelo_roteiro_reorg" ("modeloId", "setorId")
SELECT DISTINCT "ModeloPeca"."modeloId", "Peca"."setorId"
FROM "ModeloPeca"
JOIN "Peca" ON "Peca"."id" = "ModeloPeca"."pecaId";

INSERT INTO "_modelo_roteiro_reorg" ("modeloId", "setorId")
SELECT DISTINCT "ModeloPeca"."modeloId", "PecaRoteiro"."setorId"
FROM "ModeloPeca"
JOIN "PecaRoteiro" ON "PecaRoteiro"."pecaId" = "ModeloPeca"."pecaId";

DELETE FROM "ModeloRoteiro";

INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT "modeloId", "setorId",
  ROW_NUMBER() OVER (PARTITION BY "modeloId" ORDER BY "ordemPadrao", "setorId")
FROM (
  SELECT DISTINCT r."modeloId", r."setorId", s."ordemPadrao"
  FROM "_modelo_roteiro_reorg" r
  JOIN "Setor" s ON s."id" = r."setorId"
);

DROP TABLE "_modelo_roteiro_reorg";
