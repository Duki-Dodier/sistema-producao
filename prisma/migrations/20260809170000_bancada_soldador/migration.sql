-- Cada soldador passa a ter uma bancada/box fixa, editável em Configurações.
ALTER TABLE "Funcionario" ADD COLUMN "bancada" TEXT;

-- Preenche os soldadores já cadastrados com boxes iniciais determinísticos.
-- O administrador pode trocar os nomes na tela de Configurações.
WITH soldadores AS (
  SELECT f."id", ROW_NUMBER() OVER (ORDER BY f."nome", f."id") AS numero
  FROM "Funcionario" f
  WHERE f."bancada" IS NULL
    AND f."setorId" IN (
      SELECT "id" FROM "Setor" WHERE UPPER(TRIM("nome")) = 'SOLDA'
    )
)
UPDATE "Funcionario"
SET "bancada" = 'BOX ' || printf('%02d', (SELECT numero FROM soldadores WHERE soldadores."id" = "Funcionario"."id"))
WHERE "id" IN (SELECT "id" FROM soldadores);
