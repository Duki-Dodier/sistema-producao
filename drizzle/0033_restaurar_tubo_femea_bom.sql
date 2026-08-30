-- A peça PONTEIRA Rem. da BOM é o tubo fêmea do engate removível. Ela recebe
-- a ponteira pequena, média ou grande e deve continuar no roteiro da OP.
-- Os SKUs PON-TB-* e PON-CH-* seguem fora da BOM e são controlados na página
-- Ponteiras.
PRAGMA foreign_keys = ON;

INSERT INTO "ModeloPeca" ("modeloId", "pecaId", "quantidadeNecessaria")
SELECT m."id", p."id", 1
FROM "Modelo" m
JOIN "Peca" p ON p."codigo" LIKE m."codigo" || '-%'
WHERE m."tipo" = 'REMOVIVEL'
  AND UPPER(TRIM(p."tipoMaterial")) = 'PONTEIRA'
  AND NOT EXISTS (
    SELECT 1
    FROM "ModeloPeca" atual
    WHERE atual."modeloId" = m."id" AND atual."pecaId" = p."id"
  );
