-- Componentes compartilhados das ponteiras removíveis.
-- Estes SKUs ficam fora da BOM das OPs e são controlados na página Ponteiras.
PRAGMA foreign_keys = ON;

INSERT INTO "Peca" (
  "codigo", "nome", "medida", "setorId", "tipoMaterial",
  "espessuraMm", "processos", "observacao", "createdAt", "updatedAt"
) VALUES
  ('PON-TB-PM', 'Tubo de ponteira pequena/média', 'Componente padrão compartilhado', 4, 'TUBO', NULL, 'CORTE', 'Ponteira removível: tubo único para os tamanhos pequena e média. Controlado fora da BOM da OP.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PON-TB-G', 'Tubo de ponteira grande', 'Componente padrão exclusivo', 4, 'TUBO', NULL, 'CORTE', 'Ponteira removível: tubo exclusivo do tamanho grande. Controlado fora da BOM da OP.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PON-CH-12', 'Chapa de ponteira 12 mm', 'Chapa padrão pequena/média', 3, 'PLASMA', 12, 'CORTE', 'Ponteira removível: chapa de 12 mm para os tamanhos pequena e média. Controlada fora da BOM da OP.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PON-CH-16', 'Chapa de ponteira 16 mm', 'Chapa padrão grande', 3, 'PLASMA', 16, 'CORTE', 'Ponteira removível: chapa de 16 mm para o tamanho grande. Controlada fora da BOM da OP.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT("codigo") DO UPDATE SET
  "nome" = excluded."nome",
  "medida" = excluded."medida",
  "setorId" = excluded."setorId",
  "tipoMaterial" = excluded."tipoMaterial",
  "espessuraMm" = excluded."espessuraMm",
  "processos" = excluded."processos",
  "observacao" = excluded."observacao",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Substitui vínculos antigos, que apontavam para peças específicas da BOM do modelo.
DELETE FROM "ConfiguracaoPonteira"
WHERE "modeloId" IN (
  SELECT "id" FROM "Modelo"
  WHERE "tipo" = 'REMOVIVEL'
);

INSERT INTO "ConfiguracaoPonteira" (
  "modeloId", "pecaTuboId", "pecaChapaId", "createdAt", "updatedAt"
)
SELECT
  m."id",
  CASE WHEN m."tamanhoPonteira" = 'GRANDE' THEN tuboGrande."id" ELSE tuboPadrao."id" END,
  CASE WHEN m."tamanhoPonteira" = 'GRANDE' THEN chapa16."id" ELSE chapa12."id" END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Modelo" m
JOIN "Peca" tuboPadrao ON tuboPadrao."codigo" = 'PON-TB-PM'
JOIN "Peca" tuboGrande ON tuboGrande."codigo" = 'PON-TB-G'
JOIN "Peca" chapa12 ON chapa12."codigo" = 'PON-CH-12'
JOIN "Peca" chapa16 ON chapa16."codigo" = 'PON-CH-16'
WHERE m."tipo" = 'REMOVIVEL'
  AND m."tamanhoPonteira" IN ('PEQUENA', 'MEDIA', 'GRANDE');
