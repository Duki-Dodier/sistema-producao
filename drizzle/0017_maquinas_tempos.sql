-- Máquinas fictícias por setor e campos de rastreabilidade do ciclo do operador.
-- Os códigos podem ser substituídos pelos nomes reais sem alterar os apontamentos.

CREATE TABLE "Maquina" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "codigo" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "setorId" INTEGER NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Maquina_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Maquina_setorId_codigo_key" ON "Maquina"("setorId", "codigo");
CREATE INDEX "Maquina_setorId_ativo_idx" ON "Maquina"("setorId", "ativo");

ALTER TABLE "Apontamento" ADD COLUMN "maquinaId" INTEGER;
ALTER TABLE "Apontamento" ADD COLUMN "tempoSegundos" INTEGER;
ALTER TABLE "Apontamento" ADD COLUMN "inicioEm" DATETIME;

CREATE INDEX "Apontamento_maquinaId_idx" ON "Apontamento"("maquinaId");

INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-plasma1', 'maq-plasma1', "id" FROM "Setor" s
WHERE s."nome" = 'PLASMA CHAPA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-plasma1');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-plasma2', 'maq-plasma2', "id" FROM "Setor" s
WHERE s."nome" = 'PLASMA CHAPA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-plasma2');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-plasma3', 'maq-plasma3', "id" FROM "Setor" s
WHERE s."nome" = 'PLASMA CHAPA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-plasma3');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-plasma4', 'maq-plasma4', "id" FROM "Setor" s
WHERE s."nome" = 'PLASMA CHAPA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-plasma4');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-plasma5', 'maq-plasma5', "id" FROM "Setor" s
WHERE s."nome" = 'PLASMA CHAPA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-plasma5');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-plasma6', 'maq-plasma6', "id" FROM "Setor" s
WHERE s."nome" = 'PLASMA CHAPA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-plasma6');

INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-corte-tubo1', 'maq-corte-tubo1', "id" FROM "Setor" s
WHERE s."nome" = 'TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-corte-tubo1');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-corte-tubo2', 'maq-corte-tubo2', "id" FROM "Setor" s
WHERE s."nome" = 'TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-corte-tubo2');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-dobra-tubo1', 'maq-dobra-tubo1', "id" FROM "Setor" s
WHERE s."nome" = 'TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-dobra-tubo1');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-dobra-tubo2', 'maq-dobra-tubo2', "id" FROM "Setor" s
WHERE s."nome" = 'TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-dobra-tubo2');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-dobra-tubo3', 'maq-dobra-tubo3', "id" FROM "Setor" s
WHERE s."nome" = 'TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-dobra-tubo3');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-dobra-tubo4', 'maq-dobra-tubo4', "id" FROM "Setor" s
WHERE s."nome" = 'TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-dobra-tubo4');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-serra-tubo1', 'maq-serra-tubo1', "id" FROM "Setor" s
WHERE s."nome" = 'TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-serra-tubo1');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-serra-tubo2', 'maq-serra-tubo2', "id" FROM "Setor" s
WHERE s."nome" = 'TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-serra-tubo2');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-serra-tubo3', 'maq-serra-tubo3', "id" FROM "Setor" s
WHERE s."nome" = 'TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-serra-tubo3');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-serra-tubo4', 'maq-serra-tubo4', "id" FROM "Setor" s
WHERE s."nome" = 'TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-serra-tubo4');

INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-plasmatubo1', 'maq-plasmatubo1', "id" FROM "Setor" s
WHERE s."nome" = 'PLASMA TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-plasmatubo1');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-plasmatubo2', 'maq-plasmatubo2', "id" FROM "Setor" s
WHERE s."nome" = 'PLASMA TUBO' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-plasmatubo2');

INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-cnc1', 'maq-cnc1', "id" FROM "Setor" s
WHERE s."nome" IN ('Componente Barra Chata e Cantoneira', 'Componente Reforço') AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-cnc1');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-cnc2', 'maq-cnc2', "id" FROM "Setor" s
WHERE s."nome" IN ('Componente Barra Chata e Cantoneira', 'Componente Reforço') AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-cnc2');

INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-guilhotina1', 'maq-guilhotina1', "id" FROM "Setor" s
WHERE s."nome" = 'PONTEIRA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-guilhotina1');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-guilhotina2', 'maq-guilhotina2', "id" FROM "Setor" s
WHERE s."nome" = 'PONTEIRA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-guilhotina2');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-prensa1', 'maq-prensa1', "id" FROM "Setor" s
WHERE s."nome" = 'PONTEIRA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-prensa1');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-prensa2', 'maq-prensa2', "id" FROM "Setor" s
WHERE s."nome" = 'PONTEIRA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-prensa2');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-dobradeira1', 'maq-dobradeira1', "id" FROM "Setor" s
WHERE s."nome" = 'PONTEIRA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-dobradeira1');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-dobradeira2', 'maq-dobradeira2', "id" FROM "Setor" s
WHERE s."nome" = 'PONTEIRA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-dobradeira2');
INSERT INTO "Maquina" ("codigo", "nome", "setorId")
SELECT 'maq-dobradeira3', 'maq-dobradeira3', "id" FROM "Setor" s
WHERE s."nome" = 'PONTEIRA' AND NOT EXISTS (SELECT 1 FROM "Maquina" m WHERE m."setorId" = s."id" AND m."codigo" = 'maq-dobradeira3');
