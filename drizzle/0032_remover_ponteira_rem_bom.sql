-- Ponteiras removíveis são conjuntos padronizados controlados na página
-- Ponteiras. Retira as peças antigas da BOM dos engates removíveis sem apagar
-- os SKUs históricos, apontamentos ou roteiros já registrados.
PRAGMA foreign_keys = ON;

DELETE FROM "ModeloPeca"
WHERE "modeloId" IN (
  SELECT "id" FROM "Modelo" WHERE "tipo" = 'REMOVIVEL'
)
AND "pecaId" IN (
  SELECT "id" FROM "Peca"
  WHERE UPPER(TRIM("tipoMaterial")) = 'PONTEIRA'
     OR UPPER(TRIM("nome")) LIKE '%PONTEIRA REM%'
);
