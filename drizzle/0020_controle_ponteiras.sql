-- Controle de ponteiras removíveis: saldo físico e vínculo técnico dos
-- componentes padronizados (tubo do Plasma Tubo + chapa do Plasma).

CREATE TABLE "ConfiguracaoPonteira" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "modeloId" INTEGER NOT NULL,
  "pecaTuboId" INTEGER NOT NULL,
  "pecaChapaId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfiguracaoPonteira_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "Modelo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConfiguracaoPonteira_pecaTuboId_fkey" FOREIGN KEY ("pecaTuboId") REFERENCES "Peca" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ConfiguracaoPonteira_pecaChapaId_fkey" FOREIGN KEY ("pecaChapaId") REFERENCES "Peca" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ConfiguracaoPonteira_modeloId_key" ON "ConfiguracaoPonteira"("modeloId");
CREATE INDEX "ConfiguracaoPonteira_pecaTuboId_idx" ON "ConfiguracaoPonteira"("pecaTuboId");
CREATE INDEX "ConfiguracaoPonteira_pecaChapaId_idx" ON "ConfiguracaoPonteira"("pecaChapaId");

CREATE TABLE "EstoquePonteira" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tamanho" TEXT NOT NULL,
  "quantidadePronta" INTEGER NOT NULL DEFAULT 0,
  "tubosCortados" INTEGER NOT NULL DEFAULT 0,
  "chapasCortadas" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "EstoquePonteira_tamanho_key" ON "EstoquePonteira"("tamanho");

INSERT OR IGNORE INTO "EstoquePonteira" ("tamanho") VALUES
  ('PEQUENA'),
  ('MEDIA'),
  ('GRANDE');

PRAGMA optimize;
