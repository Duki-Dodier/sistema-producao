-- Mantém o histórico, mas retira da operação as máquinas fictícias do Plasma Tubo.
UPDATE "Maquina"
SET "ativo" = 0, "updatedAt" = CURRENT_TIMESTAMP
WHERE "codigo" IN ('maq-plasmatubo1', 'maq-plasmatubo2')
  AND "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA TUBO' LIMIT 1);

-- O Plasma Chapa passa a ter somente estes dois programadores ativos.
UPDATE "Funcionario"
SET "ativo" = 0, "updatedAt" = CURRENT_TIMESTAMP
WHERE "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1)
  AND "usuario" NOT IN ('breno', 'luizhenrique');

INSERT INTO "Funcionario" (
  "nome", "setorId", "ativo", "pin", "papel", "usuario", "senhaHash", "administrador", "updatedAt"
)
SELECT
  'BRENO', "id", 1, '1234', 'OPERADOR', 'breno',
  'pbkdf2_sha256$100000$61ab1480b59003be6ab311af707e8cf4$e7fe8ad007bb03950ce43de4c6df3f790c5edfd818b9727b659072b53589d889',
  0, CURRENT_TIMESTAMP
FROM "Setor"
WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "Funcionario" WHERE "usuario" = 'breno');

INSERT INTO "Funcionario" (
  "nome", "setorId", "ativo", "pin", "papel", "usuario", "senhaHash", "administrador", "updatedAt"
)
SELECT
  'LUIZ HENRIQUE', "id", 1, '1234', 'OPERADOR', 'luizhenrique',
  'pbkdf2_sha256$100000$61ab1480b59003be6ab311af707e8cf4$e7fe8ad007bb03950ce43de4c6df3f790c5edfd818b9727b659072b53589d889',
  0, CURRENT_TIMESTAMP
FROM "Setor"
WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA'
  AND NOT EXISTS (SELECT 1 FROM "Funcionario" WHERE "usuario" = 'luizhenrique');

UPDATE "Funcionario"
SET "nome" = 'BRENO',
    "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1),
    "ativo" = 1,
    "pin" = '1234',
    "papel" = 'OPERADOR',
    "senhaHash" = 'pbkdf2_sha256$100000$61ab1480b59003be6ab311af707e8cf4$e7fe8ad007bb03950ce43de4c6df3f790c5edfd818b9727b659072b53589d889',
    "administrador" = 0,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "usuario" = 'breno';

UPDATE "Funcionario"
SET "nome" = 'LUIZ HENRIQUE',
    "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1),
    "ativo" = 1,
    "pin" = '1234',
    "papel" = 'OPERADOR',
    "senhaHash" = 'pbkdf2_sha256$100000$61ab1480b59003be6ab311af707e8cf4$e7fe8ad007bb03950ce43de4c6df3f790c5edfd818b9727b659072b53589d889',
    "administrador" = 0,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "usuario" = 'luizhenrique';

DELETE FROM "OperadorSessao"
WHERE "funcionarioId" IN (
  SELECT "id" FROM "Funcionario"
  WHERE "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'PLASMA CHAPA' LIMIT 1)
    AND "usuario" NOT IN ('breno', 'luizhenrique')
);

INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo")
SELECT "id", 'PRODUCAO' FROM "Funcionario" WHERE "usuario" IN ('breno', 'luizhenrique');
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo")
SELECT "id", 'CORTE' FROM "Funcionario" WHERE "usuario" IN ('breno', 'luizhenrique');

PRAGMA optimize;

