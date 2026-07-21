-- Publica as imagens técnicas atualizadas do AD1001 e associa cada arquivo
-- ao item correto para que elas apareçam nas fichas e nos documentos de OP.
UPDATE "Modelo"
SET "imagemUrl" = '/uploads/AD1001/modelo/AD1001.png'
WHERE "codigo" = 'AD1001';

UPDATE "Peca"
SET "imagemUrl" = '/uploads/AD1001/pecas/AD1001-PL1.png'
WHERE "codigo" = 'AD1001-PL1';

UPDATE "Peca"
SET "imagemUrl" = '/uploads/AD1001/pecas/AD1001-PL2.png'
WHERE "codigo" = 'AD1001-PL2';

UPDATE "Peca"
SET "imagemUrl" = '/uploads/AD1001/pecas/AD1001-TB.png'
WHERE "codigo" = 'AD1001-TB';

UPDATE "Peca"
SET "imagemUrl" = '/uploads/AD1001/pecas/AD1001-CB.png'
WHERE "codigo" = 'AD1001-CB';

UPDATE "Peca"
SET "imagemUrl" = '/uploads/AD1001/pecas/AD1001-RCB.png'
WHERE "codigo" = 'AD1001-RCB';
