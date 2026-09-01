-- Sincroniza o banco do site com as OPs abertas que estavam na versão local
-- no momento desta publicação. Os registros de produção antigos são removidos
-- para que o teste comece com a mesma base da máquina local.

DELETE FROM "NestItem";
DELETE FROM "NestCorte";
DELETE FROM "ProducaoEmAndamento";
DELETE FROM "EntradaEstoque";
DELETE FROM "RecebimentoAgrupamento";
DELETE FROM "Apontamento";
DELETE FROM "HistoricoAlteracao"
WHERE "entidade" IN ('OP', 'APONTAMENTO', 'NEST');
DELETE FROM "OP";

INSERT INTO "OP" (
  "id", "numeroSequencia", "lote", "modeloId", "quantidade", "status",
  "dataLiberacao", "previsaoEntrega", "createdAt", "updatedAt"
)
SELECT 28, 0, '1', "id", 30, 'ABERTA',
       '2026-09-01T14:51:15.003+00:00', NULL,
       '2026-09-01T14:51:15.003+00:00', '2026-09-01T14:51:15.003+00:00'
FROM "Modelo"
WHERE "codigo" = 'FT4019';

INSERT INTO "OP" (
  "id", "numeroSequencia", "lote", "modeloId", "quantidade", "status",
  "dataLiberacao", "previsaoEntrega", "createdAt", "updatedAt"
)
SELECT 29, 1, '2', "id", 20, 'ABERTA',
       '2026-09-01T14:51:24.942+00:00', NULL,
       '2026-09-01T14:51:24.942+00:00', '2026-09-01T14:51:24.942+00:00'
FROM "Modelo"
WHERE "codigo" = 'AD1001';

INSERT INTO "OP" (
  "id", "numeroSequencia", "lote", "modeloId", "quantidade", "status",
  "dataLiberacao", "previsaoEntrega", "createdAt", "updatedAt"
)
SELECT 30, 2, '3', "id", 50, 'ABERTA',
       '2026-09-01T14:51:38.643+00:00', NULL,
       '2026-09-01T14:51:38.643+00:00', '2026-09-01T14:51:38.643+00:00'
FROM "Modelo"
WHERE "codigo" = 'AD1002N';
