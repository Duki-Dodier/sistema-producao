-- Plasma Chapa possui somente estas seis máquinas operacionais. Cadastros
-- automáticos antigos permanecem no histórico, porém ficam inativos.
UPDATE "Maquina"
SET "ativo" = CASE
  WHEN "codigo" IN ('PLS', 'MAXIMUS', 'VW', 'MACHTON', 'TOP PLASMA', 'DELTA') THEN 1
  ELSE 0
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "setorId" = (SELECT "id" FROM "Setor" WHERE UPPER("nome") = 'PLASMA CHAPA' LIMIT 1);

PRAGMA optimize;
