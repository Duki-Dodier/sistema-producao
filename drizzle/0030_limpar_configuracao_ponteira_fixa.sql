-- Configurações de ponteira só existem para engates removíveis.
DELETE FROM "ConfiguracaoPonteira"
WHERE "modeloId" IN (
  SELECT "id" FROM "Modelo"
  WHERE "tipo" <> 'REMOVIVEL'
);
