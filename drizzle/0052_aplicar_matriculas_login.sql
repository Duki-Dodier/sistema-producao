-- Aplica as matrículas padronizadas aos funcionários que já existem no MES.
-- A senha não é alterada: os acessos existentes continuam com a senha 1234.

UPDATE "Funcionario" SET "usuario" = 'tub001'
WHERE UPPER(TRIM("nome")) = 'CARLOS' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'TUBO' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'tub002'
WHERE UPPER(TRIM("nome")) = 'JOAO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'TUBO' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'tub003'
WHERE UPPER(TRIM("nome")) = 'MARCOS' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'TUBO' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'tub004'
WHERE UPPER(TRIM("nome")) = 'RAFAEL' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'TUBO' LIMIT 1);

UPDATE "Funcionario" SET "usuario" = 'plch001'
WHERE UPPER(TRIM("nome")) = 'CAIO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'plch002'
WHERE UPPER(TRIM("nome")) = 'FABIO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'plch003'
WHERE UPPER(TRIM("nome")) = 'GILBERTO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'plch004'
WHERE UPPER(TRIM("nome")) = 'LEANDRO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1);

UPDATE "Funcionario" SET "usuario" = 'pltb001'
WHERE UPPER(TRIM("nome")) = 'ALAN' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA TUBO' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'pltb002'
WHERE UPPER(TRIM("nome")) = 'BRUNO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA TUBO' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'pltb003'
WHERE UPPER(TRIM("nome")) = 'DIEGO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA TUBO' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'pltb004'
WHERE UPPER(TRIM("nome")) = 'EVANDRO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA TUBO' LIMIT 1);

UPDATE "Funcionario" SET "usuario" = 'cbc001'
WHERE UPPER(TRIM("nome")) = 'ANDRE' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'COMPONENTE BARRA CHATA E CANTONEIRA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'cbc002'
WHERE UPPER(TRIM("nome")) = 'CLEBER' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'COMPONENTE BARRA CHATA E CANTONEIRA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'cbc003'
WHERE UPPER(TRIM("nome")) = 'DOUGLAS' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'COMPONENTE BARRA CHATA E CANTONEIRA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'cbc004'
WHERE UPPER(TRIM("nome")) = 'RENATO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'COMPONENTE BARRA CHATA E CANTONEIRA' LIMIT 1);

UPDATE "Funcionario" SET "usuario" = 'pont001'
WHERE UPPER(TRIM("nome")) = 'ALEX' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PONTEIRA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'pont002'
WHERE UPPER(TRIM("nome")) = 'EDUARDO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PONTEIRA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'pont003'
WHERE UPPER(TRIM("nome")) = 'HUGO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PONTEIRA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'pont004'
WHERE UPPER(TRIM("nome")) = 'RODRIGO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PONTEIRA' LIMIT 1);

UPDATE "Funcionario" SET "usuario" = 'agrup001'
WHERE UPPER(TRIM("nome")) = 'ANA' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'AGRUPAMENTO' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'agrup002'
WHERE UPPER(TRIM("nome")) = 'BRUNA' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'AGRUPAMENTO' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'agrup003'
WHERE UPPER(TRIM("nome")) = 'LUCAS' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'AGRUPAMENTO' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'agrup004'
WHERE UPPER(TRIM("nome")) = 'PAULO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'AGRUPAMENTO' LIMIT 1);

UPDATE "Funcionario" SET "usuario" = 'sold001'
WHERE UPPER(TRIM("nome")) = 'PEDRO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'SOLDA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'sold002'
WHERE UPPER(TRIM("nome")) = 'ANTONIO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'SOLDA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'sold003'
WHERE UPPER(TRIM("nome")) = 'MARIO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'SOLDA' LIMIT 1);

UPDATE "Funcionario" SET "usuario" = 'pint001'
WHERE UPPER(TRIM("nome")) = 'DANIEL' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PINTURA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'pint002'
WHERE UPPER(TRIM("nome")) = 'ELIAS' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PINTURA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'pint003'
WHERE UPPER(TRIM("nome")) = 'MAURICIO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PINTURA' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'pint004'
WHERE UPPER(TRIM("nome")) = 'WESLEY' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PINTURA' LIMIT 1);

UPDATE "Funcionario" SET "usuario" = 'mont001'
WHERE UPPER(TRIM("nome")) = 'FELIPE' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'MONTAGEM' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'mont002'
WHERE UPPER(TRIM("nome")) = 'GUSTAVO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'MONTAGEM' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'mont003'
WHERE UPPER(TRIM("nome")) = 'RICARDO' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'MONTAGEM' LIMIT 1);
UPDATE "Funcionario" SET "usuario" = 'mont004'
WHERE UPPER(TRIM("nome")) = 'VINICIUS' AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'MONTAGEM' LIMIT 1);

UPDATE "Funcionario" SET "usuario" = 'pcp005'
WHERE UPPER(TRIM("nome")) LIKE 'TIAGO ANDRADE%' AND UPPER(TRIM("papel")) = 'PCP';

UPDATE "ContaAcesso"
SET "usuario" = (SELECT "usuario" FROM "Funcionario" WHERE "Funcionario"."id" = "ContaAcesso"."funcionarioId"),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "funcionarioId" IN (SELECT "id" FROM "Funcionario" WHERE "usuario" IS NOT NULL);

PRAGMA optimize;
