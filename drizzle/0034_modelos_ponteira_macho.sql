-- Modelos próprios para fabricar as ponteiras macho intercambiáveis.
-- O tubo fêmea "Ponteira Rem." continua nas BOMs dos engates removíveis;
-- estes três SKUs representam somente o conjunto macho (tubo + chapa).
PRAGMA foreign_keys = ON;

UPDATE "Peca"
SET "observacao" = CASE "codigo"
  WHEN 'PON-TB-PM' THEN 'BOM das ponteiras macho pequena e média; saldo compartilhado também pode ser controlado livremente.'
  WHEN 'PON-TB-G' THEN 'BOM da ponteira macho grande; saldo do tubo grande controlado na página Ponteiras Macho.'
  WHEN 'PON-CH-12' THEN 'BOM das ponteiras macho pequena e média; chapa 12 mm controlada na página Ponteiras Macho.'
  WHEN 'PON-CH-16' THEN 'BOM da ponteira macho grande; chapa 16 mm controlada na página Ponteiras Macho.'
  ELSE "observacao"
END
WHERE "codigo" IN ('PON-TB-PM', 'PON-TB-G', 'PON-CH-12', 'PON-CH-16');

INSERT INTO "Modelo" ("codigo", "nome", "curva", "tipo", "tamanhoPonteira", "linhaProduto", "createdAt", "updatedAt")
VALUES
  ('PONT-P', 'Ponteira macho pequena', 'A', 'PONTEIRA_MACHO', 'PEQUENA', 'BRUCKE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PONT-M', 'Ponteira macho média',   'A', 'PONTEIRA_MACHO', 'MEDIA',   'BRUCKE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PONT-G', 'Ponteira macho grande',  'A', 'PONTEIRA_MACHO', 'GRANDE',  'BRUCKE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT("codigo") DO UPDATE SET
  "nome" = excluded."nome",
  "curva" = excluded."curva",
  "tipo" = excluded."tipo",
  "tamanhoPonteira" = excluded."tamanhoPonteira",
  "linhaProduto" = excluded."linhaProduto",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Cada tamanho recebe o tubo e a chapa correspondentes como BOM própria.
-- Pequena e média usam o mesmo tubo PON-TB-PM e chapa 12 mm.
DELETE FROM "ModeloPeca"
WHERE "modeloId" IN (SELECT "id" FROM "Modelo" WHERE "tipo" = 'PONTEIRA_MACHO');

INSERT INTO "ModeloPeca" ("modeloId", "pecaId", "quantidadeNecessaria")
SELECT m."id", p."id", 1
FROM "Modelo" m
JOIN "Peca" p ON p."codigo" = CASE
  WHEN m."tamanhoPonteira" IN ('PEQUENA', 'MEDIA') THEN 'PON-TB-PM'
  ELSE 'PON-TB-G'
END
WHERE m."tipo" = 'PONTEIRA_MACHO';

INSERT INTO "ModeloPeca" ("modeloId", "pecaId", "quantidadeNecessaria")
SELECT m."id", p."id", 1
FROM "Modelo" m
JOIN "Peca" p ON p."codigo" = CASE
  WHEN m."tamanhoPonteira" IN ('PEQUENA', 'MEDIA') THEN 'PON-CH-12'
  ELSE 'PON-CH-16'
END
WHERE m."tipo" = 'PONTEIRA_MACHO';

-- A chapa da ponteira macho passa por corte, dobra no setor de componentes e soldagem.
-- O tubo passa por corte e, junto com a chapa, é unido por soldagem no setor Ponteira.
INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem")
SELECT p."id", s."id", 'CORTE', 1
FROM "Peca" p
JOIN "Setor" s ON UPPER(TRIM(s."nome")) = 'PLASMA TUBO'
WHERE p."codigo" IN ('PON-TB-PM', 'PON-TB-G')
  AND NOT EXISTS (SELECT 1 FROM "PecaRoteiro" r WHERE r."pecaId" = p."id" AND r."ordem" = 1);

INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem")
SELECT p."id", s."id", 'CORTE', 1
FROM "Peca" p
JOIN "Setor" s ON UPPER(TRIM(s."nome")) = 'PLASMA CHAPA'
WHERE p."codigo" IN ('PON-CH-12', 'PON-CH-16')
  AND NOT EXISTS (SELECT 1 FROM "PecaRoteiro" r WHERE r."pecaId" = p."id" AND r."ordem" = 1);

INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem")
SELECT p."id", s."id", 'DOBRA', 2
FROM "Peca" p
JOIN "Setor" s ON UPPER(TRIM(s."nome")) = 'COMPONENTE BARRA CHATA E CANTONEIRA'
WHERE p."codigo" IN ('PON-CH-12', 'PON-CH-16')
  AND NOT EXISTS (SELECT 1 FROM "PecaRoteiro" r WHERE r."pecaId" = p."id" AND r."ordem" = 2);

INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem")
SELECT p."id", s."id", 'SOLDAGEM', 3
FROM "Peca" p
JOIN "Setor" s ON UPPER(TRIM(s."nome")) = 'PONTEIRA'
WHERE p."codigo" IN ('PON-TB-PM', 'PON-TB-G', 'PON-CH-12', 'PON-CH-16')
  AND NOT EXISTS (SELECT 1 FROM "PecaRoteiro" r WHERE r."pecaId" = p."id" AND r."ordem" = 3);

-- O roteiro do modelo é usado pelo painel para liberar a OP nos três postos.
DELETE FROM "ModeloRoteiro"
WHERE "modeloId" IN (SELECT "id" FROM "Modelo" WHERE "tipo" = 'PONTEIRA_MACHO');

INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT m."id", s."id", 1
FROM "Modelo" m CROSS JOIN "Setor" s
WHERE m."tipo" = 'PONTEIRA_MACHO' AND UPPER(TRIM(s."nome")) = 'PLASMA TUBO';

INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT m."id", s."id", 2
FROM "Modelo" m CROSS JOIN "Setor" s
WHERE m."tipo" = 'PONTEIRA_MACHO' AND UPPER(TRIM(s."nome")) = 'PLASMA CHAPA';

INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT m."id", s."id", 3
FROM "Modelo" m CROSS JOIN "Setor" s
WHERE m."tipo" = 'PONTEIRA_MACHO' AND UPPER(TRIM(s."nome")) = 'PONTEIRA';
