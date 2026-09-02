-- Atualiza os nomes das seis máquinas do Plasma Chapa sem alterar
-- apontamentos, nests ou qualquer outro vínculo histórico.
UPDATE "Maquina"
SET "codigo" = 'PLS', "nome" = 'PLS'
WHERE "codigo" = 'maq-plasma1'
  AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1);

UPDATE "Maquina"
SET "codigo" = 'MAXIMUS', "nome" = 'MAXIMUS'
WHERE "codigo" = 'maq-plasma2'
  AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1);

UPDATE "Maquina"
SET "codigo" = 'VW', "nome" = 'VW'
WHERE "codigo" = 'maq-plasma3'
  AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1);

UPDATE "Maquina"
SET "codigo" = 'MACHTON', "nome" = 'MACHTON'
WHERE "codigo" = 'maq-plasma4'
  AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1);

UPDATE "Maquina"
SET "codigo" = 'TOP PLASMA', "nome" = 'TOP PLASMA'
WHERE "codigo" = 'maq-plasma5'
  AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1);

UPDATE "Maquina"
SET "codigo" = 'DELTA', "nome" = 'DELTA'
WHERE "codigo" = 'maq-plasma6'
  AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1);
