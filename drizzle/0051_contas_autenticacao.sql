-- Tabela administrativa de autenticação, separada do cadastro operacional.
CREATE TABLE IF NOT EXISTS "ContaAcesso" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "funcionarioId" INTEGER NOT NULL,
  "usuario" TEXT NOT NULL,
  "senhaHash" TEXT NOT NULL,
  "senhaTemporaria" TEXT NOT NULL DEFAULT '1234',
  "ativo" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContaAcesso_funcionarioId_fkey"
    FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContaAcesso_funcionarioId_key"
  ON "ContaAcesso" ("funcionarioId");
CREATE UNIQUE INDEX IF NOT EXISTS "ContaAcesso_usuario_key"
  ON "ContaAcesso" ("usuario");
CREATE INDEX IF NOT EXISTS "ContaAcesso_ativo_idx"
  ON "ContaAcesso" ("ativo");

-- Os acessos existentes já usam senha 1234 no sistema atual. A senha em
-- texto fica disponível somente para o administrador consultar na tela de
-- configurações; o login continuará validando a cópia protegida.
INSERT OR IGNORE INTO "ContaAcesso"
  ("funcionarioId", "usuario", "senhaHash", "senhaTemporaria", "ativo", "createdAt", "updatedAt")
SELECT "id", "usuario", "senhaHash", '1234', "ativo", "createdAt", "updatedAt"
FROM "Funcionario"
WHERE "usuario" IS NOT NULL AND "senhaHash" IS NOT NULL;

PRAGMA optimize;
