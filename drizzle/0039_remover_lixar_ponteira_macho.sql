-- A etapa Ponteira une a chapa e o tubo por soldagem.
-- Não há lixamento para esses componentes padronizados.
DELETE FROM "PecaRoteiro"
WHERE "pecaId" IN (
  SELECT "id" FROM "Peca"
  WHERE "codigo" IN ('PON-TB-PM', 'PON-TB-G', 'PON-CH-12', 'PON-CH-16')
)
AND "processo" = 'LIXAR';
