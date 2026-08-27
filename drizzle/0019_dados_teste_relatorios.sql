-- Dados de demonstração para validar os relatórios de tempo de produção.
-- A carga é identificável por TESTE e pode ser reaplicada sem duplicar registros.

INSERT INTO "OP" ("numeroSequencia", "lote", "modeloId", "quantidade", "status", "dataLiberacao", "dataFinalizacao", "createdAt", "updatedAt")
SELECT 201, 'TESTE-REL-BM1000-01', "id", 10, 'CONCLUIDA',
       datetime('now', '-12 days'), datetime('now', '-12 days', '+4 hours', '+40 minutes'),
       datetime('now', '-12 days'), datetime('now', '-12 days')
FROM "Modelo"
WHERE "codigo" = 'BM1000'
  AND NOT EXISTS (SELECT 1 FROM "OP" WHERE "lote" = 'TESTE-REL-BM1000-01');

INSERT INTO "OP" ("numeroSequencia", "lote", "modeloId", "quantidade", "status", "dataLiberacao", "dataFinalizacao", "createdAt", "updatedAt")
SELECT 202, 'TESTE-REL-BM1000-02', "id", 12, 'CONCLUIDA',
       datetime('now', '-8 days'), datetime('now', '-8 days', '+5 hours', '+20 minutes'),
       datetime('now', '-8 days'), datetime('now', '-8 days')
FROM "Modelo"
WHERE "codigo" = 'BM1000'
  AND NOT EXISTS (SELECT 1 FROM "OP" WHERE "lote" = 'TESTE-REL-BM1000-02');

INSERT INTO "OP" ("numeroSequencia", "lote", "modeloId", "quantidade", "status", "dataLiberacao", "dataFinalizacao", "createdAt", "updatedAt")
SELECT 203, 'TESTE-REL-BM1000-03', "id", 8, 'CONCLUIDA',
       datetime('now', '-3 days'), datetime('now', '-3 days', '+4 hours', '+55 minutes'),
       datetime('now', '-3 days'), datetime('now', '-3 days')
FROM "Modelo"
WHERE "codigo" = 'BM1000'
  AND NOT EXISTS (SELECT 1 FROM "OP" WHERE "lote" = 'TESTE-REL-BM1000-03');

WITH "demo" ("lote", "pecaCodigo", "usuario", "maquinaCodigo", "quantidade", "tempoSegundos", "diasAtras", "minutosAtras", "processo") AS (
  VALUES
    ('TESTE-REL-BM1000-01', 'BM1000-TB',  'JOAO',    'maq-corte-tubo1',  10, 2700, 12, 420, 'CORTE TUBO'),
    ('TESTE-REL-BM1000-01', 'BM1000-CB',  'ALAN',    'maq-plasmatubo1',  10, 2100, 12, 300, 'CORTE PLASMA TUBO'),
    ('TESTE-REL-BM1000-01', 'BM1000-RCB', 'ANTONIO', 'maq-cnc1',        10, 3300, 12, 180, 'CNC'),
    ('TESTE-REL-BM1000-01', 'BM1000-PL1', 'CAIO',    'maq-plasma1',      10, 2400, 12, 120, 'CORTE PLASMA'),
    ('TESTE-REL-BM1000-01', 'BM1000-PL2', 'FABIO',   'maq-plasma2',      10, 2550, 12, 60,  'CORTE PLASMA'),
    ('TESTE-REL-BM1000-02', 'BM1000-TB',  'MARCOS',  'maq-corte-tubo2',  12, 3000, 8,  420, 'CORTE TUBO'),
    ('TESTE-REL-BM1000-02', 'BM1000-CB',  'BRUNO',   'maq-plasmatubo2',  12, 2250, 8,  300, 'CORTE PLASMA TUBO'),
    ('TESTE-REL-BM1000-02', 'BM1000-RCB', 'PEDRO',   'maq-cnc2',          12, 3600, 8,  180, 'CNC'),
    ('TESTE-REL-BM1000-02', 'BM1000-PL1', 'GILBERTO','maq-plasma3',      12, 2700, 8,  120, 'CORTE PLASMA'),
    ('TESTE-REL-BM1000-02', 'BM1000-PL2', 'LEANDRO', 'maq-plasma4',      12, 2850, 8,  60,  'CORTE PLASMA'),
    ('TESTE-REL-BM1000-03', 'BM1000-TB',  'RAFAEL',  'maq-dobra-tubo1',  8,  2400, 3,  420, 'DOBRA TUBO'),
    ('TESTE-REL-BM1000-03', 'BM1000-CB',  'DIEGO',   'maq-plasmatubo1',  8,  1950, 3,  300, 'CORTE PLASMA TUBO'),
    ('TESTE-REL-BM1000-03', 'BM1000-RCB', 'MARIO',   'maq-cnc1',          8,  3000, 3,  180, 'CNC'),
    ('TESTE-REL-BM1000-03', 'BM1000-PL1', 'FABIO',   'maq-plasma5',       8,  2250, 3,  120, 'CORTE PLASMA'),
    ('TESTE-REL-BM1000-03', 'BM1000-PL2', 'CAIO',    'maq-plasma6',       8,  2400, 3,  60,  'CORTE PLASMA')
)
INSERT INTO "Apontamento" (
  "opId", "setorId", "funcionarioId", "usuario", "quantidadeBoa", "quantidadeRefugo", "dataHora",
  "pecaId", "processo", "roteiroEtapaId", "origem", "maquinaId", "tempoSegundos", "inicioEm"
)
SELECT
  op."id", peca."setorId", funcionario."id", demo."usuario", demo."quantidade", 0,
  datetime('now', '-' || (demo."diasAtras" * 1440 + demo."minutosAtras") || ' minutes'),
  peca."id", demo."processo", NULL, 'TESTE', maquina."id", demo."tempoSegundos",
  datetime('now', '-' || (demo."diasAtras" * 1440 + demo."minutosAtras") || ' minutes', '-' || demo."tempoSegundos" || ' seconds')
FROM "demo" demo
JOIN "OP" op ON op."lote" = demo."lote"
JOIN "Peca" peca ON peca."codigo" = demo."pecaCodigo"
JOIN "Funcionario" funcionario ON funcionario."nome" = demo."usuario"
JOIN "Maquina" maquina ON maquina."codigo" = demo."maquinaCodigo" AND maquina."setorId" = peca."setorId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "Apontamento" existente
  WHERE existente."origem" = 'TESTE'
    AND existente."opId" = op."id"
    AND existente."pecaId" = peca."id"
    AND existente."usuario" = demo."usuario"
);
