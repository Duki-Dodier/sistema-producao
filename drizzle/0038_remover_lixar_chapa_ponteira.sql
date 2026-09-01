-- As chapas das ponteiras macho terminam na soldagem.
-- Remove somente a etapa de lixamento do roteiro dessas duas chapas;
-- apontamentos e demais vínculos permanecem preservados.
DELETE FROM "PecaRoteiro"
WHERE "pecaId" IN (
  SELECT "id" FROM "Peca" WHERE "codigo" IN ('PON-CH-12', 'PON-CH-16')
)
AND "processo" = 'LIXAR';
