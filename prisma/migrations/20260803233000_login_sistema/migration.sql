-- Login geral do MES usando os funcionarios ja cadastrados.
ALTER TABLE "Funcionario" ADD COLUMN "usuario" TEXT;
ALTER TABLE "Funcionario" ADD COLUMN "senhaHash" TEXT;
ALTER TABLE "Funcionario" ADD COLUMN "administrador" BOOLEAN NOT NULL DEFAULT false;

-- O usuario inicial e o primeiro nome. Nomes repetidos recebem o id.
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

-- Credencial provisoria solicitada: todos os usuarios de teste usam 1234.
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
  "papel" = 'PCP', "administrador" = true, "ativo" = true
WHERE LOWER(TRIM("nome")) = 'tiago andrade';

-- Tiago usa o primeiro setor apenas para satisfazer a relacao obrigatoria.
-- O perfil de administrador nao fica limitado a esse setor.
INSERT INTO "Funcionario" (
  "nome", "setorId", "ativo", "pin", "papel", "usuario", "senhaHash", "administrador", "updatedAt"
)
SELECT
  'TIAGO ANDRADE', "id", true, '1234', 'PCP', 'tiago',
  'pbkdf2_sha256$120000$61ab1480b59003be6ab311af707e8cf4$135515a6d8830604a1977388506ed66403183ce5ae9fae9439b4ce0be1591504',
  true, CURRENT_TIMESTAMP
FROM "Setor"
WHERE NOT EXISTS (SELECT 1 FROM "Funcionario" WHERE "usuario" = 'tiago')
ORDER BY "ordemPadrao", "id"
LIMIT 1;

CREATE UNIQUE INDEX "Funcionario_usuario_key" ON "Funcionario"("usuario");

INSERT OR IGNORE INTO "FuncionarioProcesso" ("funcionarioId", "processo")
SELECT f."id", p."processo"
FROM "Funcionario" f
CROSS JOIN (
  SELECT 'PRODUCAO' AS "processo" UNION ALL SELECT 'CORTE' UNION ALL SELECT 'BATIDA'
  UNION ALL SELECT 'FURACAO' UNION ALL SELECT 'DOBRA' UNION ALL SELECT 'AMASSAR'
  UNION ALL SELECT 'CORTE_GRAU' UNION ALL SELECT 'LIXAR' UNION ALL SELECT 'SOLDAGEM'
  UNION ALL SELECT 'AGRUPAR'
) p
WHERE f."usuario" = 'tiago';
