-- CreateTable
CREATE TABLE "Setor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "ordemPadrao" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Modelo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "curva" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ModeloRoteiro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modeloId" INTEGER NOT NULL,
    "setorId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    CONSTRAINT "ModeloRoteiro_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "Modelo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModeloRoteiro_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OP" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numeroSequencia" INTEGER NOT NULL,
    "modeloId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "dataLiberacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OP_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "Modelo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Apontamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opId" INTEGER NOT NULL,
    "setorId" INTEGER NOT NULL,
    "usuario" TEXT NOT NULL,
    "quantidadeBoa" INTEGER NOT NULL DEFAULT 0,
    "quantidadeRefugo" INTEGER NOT NULL DEFAULT 0,
    "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Apontamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Setor_nome_key" ON "Setor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Modelo_codigo_key" ON "Modelo"("codigo");

-- CreateIndex
CREATE INDEX "ModeloRoteiro_setorId_idx" ON "ModeloRoteiro"("setorId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloRoteiro_modeloId_setorId_key" ON "ModeloRoteiro"("modeloId", "setorId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloRoteiro_modeloId_ordem_key" ON "ModeloRoteiro"("modeloId", "ordem");

-- CreateIndex
CREATE INDEX "OP_modeloId_idx" ON "OP"("modeloId");

-- CreateIndex
CREATE INDEX "OP_numeroSequencia_idx" ON "OP"("numeroSequencia");

-- CreateIndex
CREATE INDEX "Apontamento_opId_idx" ON "Apontamento"("opId");

-- CreateIndex
CREATE INDEX "Apontamento_setorId_idx" ON "Apontamento"("setorId");
