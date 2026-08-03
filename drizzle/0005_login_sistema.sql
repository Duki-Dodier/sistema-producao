-- Login geral do MES usando os funcionarios ja cadastrados.
ALTER TABLE "Funcionario" ADD COLUMN "usuario" TEXT;
ALTER TABLE "Funcionario" ADD COLUMN "senhaHash" TEXT;
ALTER TABLE "Funcionario" ADD COLUMN "administrador" INTEGER NOT NULL DEFAULT 0;

UPDATE "Funcionario"
SET "usuario" = LOWER(
  CASE
    WHEN INSTR(TRIM("nome"), ' ') > 0
      THEN SUBSTR(TRIM("nome"), 1, INSTR(TRIM("nome"), ' ') - 1)
    ELSE TRIM("nome")
  END
);
UPDATE "Funcionario" AS atual
SET "usuario" = "usuario" || "id"
WHERE EXISTS (
  SELECT 1 FROM "Funcionario" AS anterior
  WHERE anterior."usuario" = atual."usuario" AND anterior."id" < atual."id"
);

UPDATE "Funcionario"
SET
  "pin" = '1234',
  "senhaHash" = 'pbkdf2_sha256$120000$61ab1480b59003be6ab311af707e8cf4$135515a6d8830604a1977388506ed66403183ce5ae9fae9439b4ce0be1591504';

-- Obriga todos os dispositivos a entrar pela nova tela de login.
DELETE FROM "OperadorSessao";

UPDATE "Funcionario"
SET
  "nome" = 'TIAGO ANDRADE', "usuario" = 'tiago', "pin" = '1234',
  "senhaHash" = 'pbkdf2_sha256$120000$61ab1480b59003be6ab311af707e8cf4$135515a6d8830604a1977388506ed66403183ce5ae9fae9439b4ce0be1591504',
  "papel" = 'PCP', "administrador" = 1, "ativo" = 1
WHERE LOWER(TRIM("nome")) = 'tiago andrade';

INSERT INTO "Funcionario" (
  "nome", "setorId", "ativo", "pin", "papel", "usuario", "senhaHash", "administrador", "updatedAt"
)
SELECT
  'TIAGO ANDRADE', "id", 1, '1234', 'PCP', 'tiago',
  'pbkdf2_sha256$120000$61ab1480b59003be6ab311af707e8cf4$135515a6d8830604a1977388506ed66403183ce5ae9fae9439b4ce0be1591504',
  1, CURRENT_TIMESTAMP
FROM "Setor"
WHERE NOT EXISTS (SELECT 1 FROM "Funcionario" WHERE "usuario" = 'tiago')
ORDER BY "ordemPadrao", "id"
LIMIT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Funcionario_usuario_key" ON "Funcionario"("usuario");

-- Instrucoes separadas evitam o limite de SELECT composto do SQLite no deploy.
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'PRODUCAO' FROM "Funcionario" WHERE "usuario" = 'tiago';
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'CORTE' FROM "Funcionario" WHERE "usuario" = 'tiago';
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'BATIDA' FROM "Funcionario" WHERE "usuario" = 'tiago';
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'FURACAO' FROM "Funcionario" WHERE "usuario" = 'tiago';
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'DOBRA' FROM "Funcionario" WHERE "usuario" = 'tiago';
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'AMASSAR' FROM "Funcionario" WHERE "usuario" = 'tiago';
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'CORTE_GRAU' FROM "Funcionario" WHERE "usuario" = 'tiago';
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'LIXAR' FROM "Funcionario" WHERE "usuario" = 'tiago';
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'SOLDAGEM' FROM "Funcionario" WHERE "usuario" = 'tiago';
INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo") SELECT "id", 'AGRUPAR' FROM "Funcionario" WHERE "usuario" = 'tiago';

PRAGMA optimize;
