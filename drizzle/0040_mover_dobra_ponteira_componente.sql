-- A dobra da chapa da ponteira macho é realizada no setor de componentes.
UPDATE "PecaRoteiro"
SET "setorId" = (
  SELECT "id"
  FROM "Setor"
  WHERE UPPER(TRIM("nome")) = 'COMPONENTE BARRA CHATA E CANTONEIRA'
  LIMIT 1
)
WHERE "pecaId" IN (
  SELECT "id" FROM "Peca"
  WHERE "codigo" IN ('PON-CH-12', 'PON-CH-16')
)
AND "processo" = 'DOBRA';
