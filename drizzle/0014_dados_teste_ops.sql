-- Dados de teste solicitados para validar OPs, apontamentos e Estoque.
-- Os lotes TESTE-* tornam a carga identificável e evitam duplicidade.

INSERT INTO "OP" ("numeroSequencia", "lote", "modeloId", "quantidade", "status", "dataLiberacao", "dataFinalizacao", "createdAt", "updatedAt")
SELECT 101, 'TESTE-AD1001-ESTOQUE-01', "id", 8, 'CONCLUIDA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Modelo"
WHERE "codigo" = 'AD1001'
  AND NOT EXISTS (SELECT 1 FROM "OP" WHERE "lote" = 'TESTE-AD1001-ESTOQUE-01');

INSERT INTO "OP" ("numeroSequencia", "lote", "modeloId", "quantidade", "status", "dataLiberacao", "dataFinalizacao", "createdAt", "updatedAt")
SELECT 102, 'TESTE-AD1002-ESTOQUE-02', "id", 12, 'CONCLUIDA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Modelo"
WHERE "codigo" = 'AD1002N'
  AND NOT EXISTS (SELECT 1 FROM "OP" WHERE "lote" = 'TESTE-AD1002-ESTOQUE-02');

INSERT INTO "OP" ("numeroSequencia", "lote", "modeloId", "quantidade", "status", "dataLiberacao", "dataFinalizacao", "createdAt", "updatedAt")
SELECT 103, 'TESTE-AD1003-ESTOQUE-03', "id", 20, 'CONCLUIDA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Modelo"
WHERE "codigo" = 'AD1003'
  AND NOT EXISTS (SELECT 1 FROM "OP" WHERE "lote" = 'TESTE-AD1003-ESTOQUE-03');

INSERT INTO "OP" ("numeroSequencia", "lote", "modeloId", "quantidade", "status", "dataLiberacao", "dataFinalizacao", "createdAt", "updatedAt")
SELECT 104, 'TESTE-AD1004-PENDENTE-04', "id", 18, 'ABERTA', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Modelo"
WHERE "codigo" = 'AD1004'
  AND NOT EXISTS (SELECT 1 FROM "OP" WHERE "lote" = 'TESTE-AD1004-PENDENTE-04');

INSERT INTO "OP" ("numeroSequencia", "lote", "modeloId", "quantidade", "status", "dataLiberacao", "dataFinalizacao", "createdAt", "updatedAt")
SELECT 105, 'TESTE-AD1001-CAMINHO-05', "id", 15, 'ABERTA', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Modelo"
WHERE "codigo" = 'AD1001'
  AND NOT EXISTS (SELECT 1 FROM "OP" WHERE "lote" = 'TESTE-AD1001-CAMINHO-05');

INSERT INTO "OP" ("numeroSequencia", "lote", "modeloId", "quantidade", "status", "dataLiberacao", "dataFinalizacao", "createdAt", "updatedAt")
SELECT 106, 'TESTE-AD1003-CAMINHO-06', "id", 9, 'ABERTA', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Modelo"
WHERE "codigo" = 'AD1003'
  AND NOT EXISTS (SELECT 1 FROM "OP" WHERE "lote" = 'TESTE-AD1003-CAMINHO-06');

-- Três OPs chegam integralmente ao Estoque e ficam concluídas.
INSERT INTO "EntradaEstoque" ("opId", "quantidade", "usuario", "dataHora")
SELECT "id", 8, 'DADOS DE TESTE', CURRENT_TIMESTAMP
FROM "OP"
WHERE "lote" = 'TESTE-AD1001-ESTOQUE-01'
  AND NOT EXISTS (SELECT 1 FROM "EntradaEstoque" WHERE "opId" = "OP"."id" AND "usuario" = 'DADOS DE TESTE');

INSERT INTO "EntradaEstoque" ("opId", "quantidade", "usuario", "dataHora")
SELECT "id", 12, 'DADOS DE TESTE', CURRENT_TIMESTAMP
FROM "OP"
WHERE "lote" = 'TESTE-AD1002-ESTOQUE-02'
  AND NOT EXISTS (SELECT 1 FROM "EntradaEstoque" WHERE "opId" = "OP"."id" AND "usuario" = 'DADOS DE TESTE');

INSERT INTO "EntradaEstoque" ("opId", "quantidade", "usuario", "dataHora")
SELECT "id", 20, 'DADOS DE TESTE', CURRENT_TIMESTAMP
FROM "OP"
WHERE "lote" = 'TESTE-AD1003-ESTOQUE-03'
  AND NOT EXISTS (SELECT 1 FROM "EntradaEstoque" WHERE "opId" = "OP"."id" AND "usuario" = 'DADOS DE TESTE');

-- Esta OP fica parcialmente no caminho: há somente 3 de 9 no Estoque.
INSERT INTO "EntradaEstoque" ("opId", "quantidade", "usuario", "dataHora")
SELECT "id", 3, 'DADOS DE TESTE', CURRENT_TIMESTAMP
FROM "OP"
WHERE "lote" = 'TESTE-AD1003-CAMINHO-06'
  AND NOT EXISTS (SELECT 1 FROM "EntradaEstoque" WHERE "opId" = "OP"."id" AND "usuario" = 'DADOS DE TESTE');

-- Apontamento pendente: 7 boas + 1 refugo de 18 no primeiro processo do tubo AD1004.
INSERT INTO "Apontamento" ("opId", "setorId", "usuario", "quantidadeBoa", "quantidadeRefugo", "dataHora", "pecaId", "processo", "roteiroEtapaId", "origem")
SELECT op."id", etapa."setorId", 'DADOS DE TESTE', 7, 1, CURRENT_TIMESTAMP, peca."id", etapa."processo", etapa."id", 'OPERADOR'
FROM "OP" op
JOIN "ModeloPeca" modeloPeca ON modeloPeca."modeloId" = op."modeloId"
JOIN "Peca" peca ON peca."id" = modeloPeca."pecaId" AND peca."codigo" = 'AD1004-TB1'
JOIN "PecaRoteiro" etapa ON etapa."pecaId" = peca."id" AND etapa."ordem" = 1
WHERE op."lote" = 'TESTE-AD1004-PENDENTE-04'
  AND NOT EXISTS (
    SELECT 1
    FROM "Apontamento" existente
    WHERE existente."opId" = op."id"
      AND existente."pecaId" = peca."id"
      AND existente."roteiroEtapaId" = etapa."id"
      AND existente."usuario" = 'DADOS DE TESTE'
  );

-- Garante que a representação dos dados de teste permaneça coerente se a carga
-- for reaplicada em um banco local já existente.
UPDATE "OP"
SET "status" = 'CONCLUIDA',
    "dataFinalizacao" = COALESCE("dataFinalizacao", CURRENT_TIMESTAMP),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "lote" IN (
  'TESTE-AD1001-ESTOQUE-01',
  'TESTE-AD1002-ESTOQUE-02',
  'TESTE-AD1003-ESTOQUE-03'
);

UPDATE "OP"
SET "status" = 'ABERTA',
    "dataFinalizacao" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "lote" IN (
  'TESTE-AD1004-PENDENTE-04',
  'TESTE-AD1001-CAMINHO-05',
  'TESTE-AD1003-CAMINHO-06'
);
