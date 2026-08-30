-- Correção da primeira linha de dados da planilha (o cabeçalho aparece duas vezes).
UPDATE "Modelo"
SET "tamanhoPonteira" = 'MEDIA',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "codigo" = 'AD1001';
