-- A Ponteira Removível é cortada no Plasma Tubo e só depois vai para a
-- Ponteira: primeiro Soldar e, por último, Lixar.
-- Os IDs existentes são preservados para não quebrar apontamentos históricos.

UPDATE "PecaRoteiro"
SET "ordem" = "ordem" + 1000
WHERE "pecaId" IN (
  SELECT "id"
  FROM "Peca"
  WHERE "tipoMaterial" = 'PONTEIRA'
    AND (
      UPPER("nome") LIKE '%PONTEIRA REM%'
      OR UPPER("nome") LIKE '%CABECA REMOVIVEL%'
      OR UPPER("nome") LIKE '%CABEÇA REMOVÍVEL%'
    )
);

UPDATE "PecaRoteiro"
SET "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA TUBO' LIMIT 1),
    "ordem" = 1
WHERE "processo" = 'CORTE'
  AND "pecaId" IN (
    SELECT "id" FROM "Peca"
    WHERE "tipoMaterial" = 'PONTEIRA'
      AND (UPPER("nome") LIKE '%PONTEIRA REM%' OR UPPER("nome") LIKE '%CABECA REMOVIVEL%' OR UPPER("nome") LIKE '%CABEÇA REMOVÍVEL%')
  );

UPDATE "PecaRoteiro"
SET "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PONTEIRA' LIMIT 1),
    "ordem" = 2
WHERE "processo" = 'SOLDAGEM'
  AND "pecaId" IN (
    SELECT "id" FROM "Peca"
    WHERE "tipoMaterial" = 'PONTEIRA'
      AND (UPPER("nome") LIKE '%PONTEIRA REM%' OR UPPER("nome") LIKE '%CABECA REMOVIVEL%' OR UPPER("nome") LIKE '%CABEÇA REMOVÍVEL%')
  );

UPDATE "PecaRoteiro"
SET "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PONTEIRA' LIMIT 1),
    "ordem" = 3
WHERE "processo" = 'LIXAR'
  AND "pecaId" IN (
    SELECT "id" FROM "Peca"
    WHERE "tipoMaterial" = 'PONTEIRA'
      AND (UPPER("nome") LIKE '%PONTEIRA REM%' OR UPPER("nome") LIKE '%CABECA REMOVIVEL%' OR UPPER("nome") LIKE '%CABEÇA REMOVÍVEL%')
  );

UPDATE "PecaRoteiro"
SET "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'AGRUPAMENTO' LIMIT 1),
    "ordem" = 4
WHERE "processo" = 'AGRUPAR'
  AND "pecaId" IN (
    SELECT "id" FROM "Peca"
    WHERE "tipoMaterial" = 'PONTEIRA'
      AND (UPPER("nome") LIKE '%PONTEIRA REM%' OR UPPER("nome") LIKE '%CABECA REMOVIVEL%' OR UPPER("nome") LIKE '%CABEÇA REMOVÍVEL%')
  );

INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem")
SELECT p."id", (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PONTEIRA' LIMIT 1), 'SOLDAGEM', 2
FROM "Peca" p
WHERE p."tipoMaterial" = 'PONTEIRA'
  AND (UPPER(p."nome") LIKE '%PONTEIRA REM%' OR UPPER(p."nome") LIKE '%CABECA REMOVIVEL%' OR UPPER(p."nome") LIKE '%CABEÇA REMOVÍVEL%')
  AND NOT EXISTS (SELECT 1 FROM "PecaRoteiro" r WHERE r."pecaId" = p."id" AND r."processo" = 'SOLDAGEM');

INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem")
SELECT p."id", (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PONTEIRA' LIMIT 1), 'LIXAR', 3
FROM "Peca" p
WHERE p."tipoMaterial" = 'PONTEIRA'
  AND (UPPER(p."nome") LIKE '%PONTEIRA REM%' OR UPPER(p."nome") LIKE '%CABECA REMOVIVEL%' OR UPPER(p."nome") LIKE '%CABEÇA REMOVÍVEL%')
  AND NOT EXISTS (SELECT 1 FROM "PecaRoteiro" r WHERE r."pecaId" = p."id" AND r."processo" = 'LIXAR');

INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem")
SELECT p."id", (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'AGRUPAMENTO' LIMIT 1), 'AGRUPAR', 4
FROM "Peca" p
WHERE p."tipoMaterial" = 'PONTEIRA'
  AND (UPPER(p."nome") LIKE '%PONTEIRA REM%' OR UPPER(p."nome") LIKE '%CABECA REMOVIVEL%' OR UPPER(p."nome") LIKE '%CABEÇA REMOVÍVEL%')
  AND NOT EXISTS (SELECT 1 FROM "PecaRoteiro" r WHERE r."pecaId" = p."id" AND r."processo" = 'AGRUPAR');

UPDATE "Peca"
SET "processos" = 'CORTE,SOLDAGEM,LIXAR'
WHERE "tipoMaterial" = 'PONTEIRA'
  AND (UPPER("nome") LIKE '%PONTEIRA REM%' OR UPPER("nome") LIKE '%CABECA REMOVIVEL%' OR UPPER("nome") LIKE '%CABEÇA REMOVÍVEL%');

PRAGMA optimize;
