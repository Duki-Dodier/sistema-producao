-- CreateTable
CREATE TABLE "Setor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "ordemPadrao" INTEGER NOT NULL DEFAULT 0,
    "metaMensal" INTEGER,
    "lider" TEXT,
    "diasUteisMes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "setorId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pin" TEXT,
    "papel" TEXT NOT NULL DEFAULT 'OPERADOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Funcionario_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AjusteApontamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "apontamentoId" INTEGER NOT NULL,
    "valorAnterior" INTEGER NOT NULL,
    "valorNovo" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorizadoPorId" INTEGER NOT NULL,
    "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AjusteApontamento_apontamentoId_fkey" FOREIGN KEY ("apontamentoId") REFERENCES "Apontamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AjusteApontamento_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "Funcionario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Peca" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "medida" TEXT,
    "imagemUrl" TEXT,
    "setorId" INTEGER NOT NULL,
    "tipoMaterial" TEXT,
    "medidaA" REAL,
    "medidaB" REAL,
    "espessuraMm" REAL,
    "comprimentoMm" REAL,
    "processos" TEXT,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Peca_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PecaCurva" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pecaId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "medidaCm" REAL,
    "anguloGraus" REAL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "maquina" TEXT,
    CONSTRAINT "PecaCurva_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecebimentoAgrupamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opId" INTEGER NOT NULL,
    "setorOrigemId" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "recebidoPor" TEXT NOT NULL,
    "localizacao" TEXT NOT NULL,
    "dataHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecebimentoAgrupamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecebimentoAgrupamento_setorOrigemId_fkey" FOREIGN KEY ("setorOrigemId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModeloPeca" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modeloId" INTEGER NOT NULL,
    "pecaId" INTEGER NOT NULL,
    "quantidadeNecessaria" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ModeloPeca_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "Modelo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModeloPeca_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PecaRoteiro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pecaId" INTEGER NOT NULL,
    "setorId" INTEGER NOT NULL,
    "processo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    CONSTRAINT "PecaRoteiro_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PecaRoteiro_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Modelo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT,
    "curva" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanhoPonteira" TEXT,
    "imagemUrl" TEXT,
    "estoqueMinimo" INTEGER,
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
    "lote" TEXT,
    "modeloId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "dataLiberacao" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previsaoEntrega" DATETIME,
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
    "soldador" TEXT,
    "bancada" TEXT,
    "abastecedor" TEXT,
    "quantidadeSoldada" INTEGER NOT NULL DEFAULT 0,
    "pecaId" INTEGER,
    "processo" TEXT,
    "roteiroEtapaId" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'OPERADOR',
    CONSTRAINT "Apontamento_opId_fkey" FOREIGN KEY ("opId") REFERENCES "OP" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_pecaId_fkey" FOREIGN KEY ("pecaId") REFERENCES "Peca" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Apontamento_roteiroEtapaId_fkey" FOREIGN KEY ("roteiroEtapaId") REFERENCES "PecaRoteiro" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConferenciaPCP" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setorId" INTEGER NOT NULL,
    "data" DATETIME NOT NULL,
    "usuario" TEXT NOT NULL,
    "totalConferido" INTEGER NOT NULL,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConferenciaPCP_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "Setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConferenciaPCPItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conferenciaId" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ConferenciaPCPItem_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES "ConferenciaPCP" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Setor_nome_key" ON "Setor"("nome");

-- CreateIndex
CREATE INDEX "Funcionario_setorId_idx" ON "Funcionario"("setorId");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_nome_setorId_key" ON "Funcionario"("nome", "setorId");

-- CreateIndex
CREATE INDEX "AjusteApontamento_apontamentoId_idx" ON "AjusteApontamento"("apontamentoId");

-- CreateIndex
CREATE INDEX "AjusteApontamento_autorizadoPorId_idx" ON "AjusteApontamento"("autorizadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "Peca_codigo_key" ON "Peca"("codigo");

-- CreateIndex
CREATE INDEX "Peca_setorId_idx" ON "Peca"("setorId");

-- CreateIndex
CREATE INDEX "Peca_tipoMaterial_medidaA_medidaB_idx" ON "Peca"("tipoMaterial", "medidaA", "medidaB");

-- CreateIndex
CREATE UNIQUE INDEX "PecaCurva_pecaId_ordem_key" ON "PecaCurva"("pecaId", "ordem");

-- CreateIndex
CREATE INDEX "RecebimentoAgrupamento_setorOrigemId_idx" ON "RecebimentoAgrupamento"("setorOrigemId");

-- CreateIndex
CREATE INDEX "RecebimentoAgrupamento_dataHora_idx" ON "RecebimentoAgrupamento"("dataHora");

-- CreateIndex
CREATE UNIQUE INDEX "RecebimentoAgrupamento_opId_categoria_key" ON "RecebimentoAgrupamento"("opId", "categoria");

-- CreateIndex
CREATE INDEX "ModeloPeca_pecaId_idx" ON "ModeloPeca"("pecaId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloPeca_modeloId_pecaId_key" ON "ModeloPeca"("modeloId", "pecaId");

-- CreateIndex
CREATE INDEX "PecaRoteiro_setorId_idx" ON "PecaRoteiro"("setorId");

-- CreateIndex
CREATE INDEX "PecaRoteiro_pecaId_setorId_idx" ON "PecaRoteiro"("pecaId", "setorId");

-- CreateIndex
CREATE UNIQUE INDEX "PecaRoteiro_pecaId_ordem_key" ON "PecaRoteiro"("pecaId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "Modelo_codigo_key" ON "Modelo"("codigo");

-- CreateIndex
CREATE INDEX "ModeloRoteiro_setorId_idx" ON "ModeloRoteiro"("setorId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloRoteiro_modeloId_setorId_key" ON "ModeloRoteiro"("modeloId", "setorId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloRoteiro_modeloId_ordem_key" ON "ModeloRoteiro"("modeloId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "OP_lote_key" ON "OP"("lote");

-- CreateIndex
CREATE INDEX "OP_modeloId_idx" ON "OP"("modeloId");

-- CreateIndex
CREATE INDEX "OP_numeroSequencia_idx" ON "OP"("numeroSequencia");

-- CreateIndex
CREATE INDEX "Apontamento_opId_idx" ON "Apontamento"("opId");

-- CreateIndex
CREATE INDEX "Apontamento_setorId_idx" ON "Apontamento"("setorId");

-- CreateIndex
CREATE INDEX "Apontamento_pecaId_idx" ON "Apontamento"("pecaId");

-- CreateIndex
CREATE INDEX "Apontamento_roteiroEtapaId_idx" ON "Apontamento"("roteiroEtapaId");

-- CreateIndex
CREATE INDEX "Apontamento_setorId_dataHora_origem_idx" ON "Apontamento"("setorId", "dataHora", "origem");

-- CreateIndex
CREATE INDEX "ConferenciaPCP_data_idx" ON "ConferenciaPCP"("data");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaPCP_setorId_data_key" ON "ConferenciaPCP"("setorId", "data");

-- CreateIndex
CREATE INDEX "ConferenciaPCPItem_conferenciaId_idx" ON "ConferenciaPCPItem"("conferenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaPCPItem_conferenciaId_categoria_key" ON "ConferenciaPCPItem"("conferenciaId", "categoria");
