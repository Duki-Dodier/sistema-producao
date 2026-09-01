-- Atualiza os códigos dos modelos de ponteira macho sem alterar OPs,
-- BOMs, roteiros ou históricos vinculados aos mesmos IDs.
UPDATE "Modelo" SET "codigo" = '__PONT_RENAME_P__' WHERE "codigo" = 'PON-M-P';
UPDATE "Modelo" SET "codigo" = '__PONT_RENAME_M__' WHERE "codigo" = 'PON-M-M';
UPDATE "Modelo" SET "codigo" = '__PONT_RENAME_G__' WHERE "codigo" = 'PON-M-G';

UPDATE "Modelo" SET "codigo" = CASE "codigo"
  WHEN '__PONT_RENAME_P__' THEN 'PONT-P'
  WHEN '__PONT_RENAME_M__' THEN 'PONT-M'
  WHEN '__PONT_RENAME_G__' THEN 'PONT-G'
  ELSE "codigo"
END
WHERE "codigo" IN ('__PONT_RENAME_P__', '__PONT_RENAME_M__', '__PONT_RENAME_G__');
