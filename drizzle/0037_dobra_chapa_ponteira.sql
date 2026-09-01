-- Inclui a dobra das chapas das ponteiras macho antes da soldagem.
-- As etapas existentes são apenas reordenadas; os IDs continuam preservados.
UPDATE "Peca"
SET "processos" = 'CORTE,DOBRA'
WHERE "codigo" IN ('PON-CH-12', 'PON-CH-16');

-- A migração é idempotente para bancos novos que já receberem a versão
-- atualizada da 0034 com a etapa DOBRA.
UPDATE "PecaRoteiro"
SET "ordem" = 101
WHERE "pecaId" IN (SELECT "id" FROM "Peca" WHERE "codigo" IN ('PON-CH-12', 'PON-CH-16'))
  AND "ordem" = 1
  AND "pecaId" NOT IN (SELECT "pecaId" FROM "PecaRoteiro" WHERE "processo" = 'DOBRA');

UPDATE "PecaRoteiro"
SET "ordem" = 102
WHERE "pecaId" IN (SELECT "id" FROM "Peca" WHERE "codigo" IN ('PON-CH-12', 'PON-CH-16'))
  AND "ordem" = 2
  AND "pecaId" NOT IN (SELECT "pecaId" FROM "PecaRoteiro" WHERE "processo" = 'DOBRA');

UPDATE "PecaRoteiro"
SET "ordem" = 103
WHERE "pecaId" IN (SELECT "id" FROM "Peca" WHERE "codigo" IN ('PON-CH-12', 'PON-CH-16'))
  AND "ordem" = 3
  AND "pecaId" NOT IN (SELECT "pecaId" FROM "PecaRoteiro" WHERE "processo" = 'DOBRA');

UPDATE "PecaRoteiro"
SET "ordem" = 1,
    "processo" = 'CORTE',
    "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1)
WHERE "pecaId" IN (SELECT "id" FROM "Peca" WHERE "codigo" IN ('PON-CH-12', 'PON-CH-16'))
  AND "ordem" = 101;

UPDATE "PecaRoteiro"
SET "ordem" = 3,
    "processo" = 'SOLDAGEM',
    "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PONTEIRA' LIMIT 1)
WHERE "pecaId" IN (SELECT "id" FROM "Peca" WHERE "codigo" IN ('PON-CH-12', 'PON-CH-16'))
  AND "ordem" = 102;

UPDATE "PecaRoteiro"
SET "ordem" = 4,
    "processo" = 'LIXAR',
    "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PONTEIRA' LIMIT 1)
WHERE "pecaId" IN (SELECT "id" FROM "Peca" WHERE "codigo" IN ('PON-CH-12', 'PON-CH-16'))
  AND "ordem" = 103;

INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem")
SELECT p."id", s."id", 'DOBRA', 2
FROM "Peca" p
JOIN "Setor" s ON UPPER(TRIM(s."nome")) = 'PONTEIRA'
WHERE p."codigo" IN ('PON-CH-12', 'PON-CH-16')
  AND NOT EXISTS (
    SELECT 1 FROM "PecaRoteiro" r
    WHERE r."pecaId" = p."id" AND r."processo" = 'DOBRA'
  );
