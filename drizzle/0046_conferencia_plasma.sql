-- Additive migration. Historical posted quantities are not rewritten.
ALTER TABLE "NestLancamento" ADD COLUMN "conferenteId" INTEGER REFERENCES "Funcionario"("id");
ALTER TABLE "NestLancamento" ADD COLUMN "conferidoEm" DATETIME;
ALTER TABLE "NestLancamento" ADD COLUMN "quantidadeConferidaBoa" INTEGER;
ALTER TABLE "NestLancamento" ADD COLUMN "quantidadeConferidaRefugo" INTEGER;
ALTER TABLE "NestLancamento" ADD COLUMN "motivoConferencia" TEXT;
CREATE INDEX "NestLancamento_pendente_idx" ON "NestLancamento"("nestItemId") WHERE "apontamentoId" IS NULL;
CREATE UNIQUE INDEX "Funcionario_conferente_plasma_unico_idx" ON "Funcionario"("papel")
WHERE "papel" = 'CONFERENTE' AND "ativo" = 1;

-- One statement owns the event and transition, also under concurrent requests.
CREATE TRIGGER "NestEvento_validar_operacao" BEFORE INSERT ON "NestEvento"
WHEN NEW.tipo IN ('INICIO', 'PAUSA', 'RETORNO', 'FIM', 'CANCELAMENTO')
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "NestCorte" n WHERE n.id = NEW.nestId AND (
      (NEW.tipo = 'INICIO' AND n.status = 'PROGRAMADO') OR
      (NEW.tipo = 'PAUSA' AND n.status = 'EM_CORTE') OR
      (NEW.tipo = 'RETORNO' AND n.status = 'PAUSADO') OR
      (NEW.tipo = 'FIM' AND n.status IN ('EM_CORTE', 'PAUSADO')) OR
      (NEW.tipo = 'CANCELAMENTO' AND n.status IN ('PROGRAMADO', 'EM_CORTE', 'PAUSADO'))
    )
  ) THEN RAISE(ABORT, 'Situacao do NEST mudou. Atualize a pagina.') END;
  SELECT CASE WHEN NEW.tipo IN ('INICIO', 'RETORNO') AND EXISTS (
    SELECT 1 FROM "NestCorte" n JOIN "NestCorte" atual ON atual.id = NEW.nestId
    WHERE n.maquinaId = atual.maquinaId AND n.id != atual.id AND n.status IN ('EM_CORTE', 'PAUSADO')
  ) THEN RAISE(ABORT, 'Maquina ocupada por outro NEST.') END;
  SELECT CASE WHEN NEW.tipo = 'FIM' AND EXISTS (
    SELECT 1 FROM "NestItem" i WHERE i.nestId = NEW.nestId AND i.quantidadePlanejada !=
      COALESCE((SELECT SUM(l.quantidadeBoa + l.quantidadeRefugo) FROM "NestLancamento" l WHERE l.nestItemId = i.id), 0)
  ) THEN RAISE(ABORT, 'Informe boas e perdas de todas as pecas antes de finalizar.') END;
END;

PRAGMA optimize;

CREATE TRIGGER "NestEvento_aplicar_operacao" AFTER INSERT ON "NestEvento"
WHEN NEW.tipo IN ('INICIO', 'PAUSA', 'RETORNO', 'FIM', 'CANCELAMENTO')
BEGIN
  UPDATE "NestCorte" SET
    status = CASE NEW.tipo WHEN 'INICIO' THEN 'EM_CORTE' WHEN 'RETORNO' THEN 'EM_CORTE'
      WHEN 'PAUSA' THEN 'PAUSADO' WHEN 'FIM' THEN 'CONCLUIDO' ELSE 'CANCELADO' END,
    iniciadoEm = CASE WHEN NEW.tipo = 'INICIO' THEN COALESCE(iniciadoEm, NEW.dataHora) ELSE iniciadoEm END,
    finalizadoEm = CASE WHEN NEW.tipo IN ('FIM', 'CANCELAMENTO') THEN NEW.dataHora ELSE finalizadoEm END,
    updatedAt = NEW.dataHora WHERE id = NEW.nestId;
END;

CREATE TRIGGER "NestLancamento_validar_declaracao" BEFORE INSERT ON "NestLancamento"
BEGIN
  SELECT CASE WHEN NEW.quantidadeBoa < 0 OR NEW.quantidadeRefugo < 0 OR
    NEW.quantidadeBoa + NEW.quantidadeRefugo <= 0 OR NEW.apontamentoId IS NOT NULL
    THEN RAISE(ABORT, 'Declaracao invalida. O apontamento exige conferencia.') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "NestItem" i JOIN "NestCorte" n ON n.id = i.nestId
    WHERE i.id = NEW.nestItemId AND n.status = 'EM_CORTE'
      AND NEW.quantidadeBoa + NEW.quantidadeRefugo + COALESCE(
        (SELECT SUM(l.quantidadeBoa + l.quantidadeRefugo) FROM "NestLancamento" l WHERE l.nestItemId = i.id), 0) <= i.quantidadePlanejada
  ) THEN RAISE(ABORT, 'Inicie o corte e respeite o saldo planejado da peca.') END;
END;

-- Atomic conference + official posting + audit trail, without Prisma interactive
-- transactions (unsupported by D1). A second confirmation cannot post twice.
CREATE TRIGGER "NestLancamento_validar_conferencia" BEFORE UPDATE OF "conferidoEm" ON "NestLancamento"
BEGIN
  SELECT CASE WHEN OLD.apontamentoId IS NOT NULL OR OLD.conferidoEm IS NOT NULL
    THEN RAISE(ABORT, 'Lancamento ja conferido.') END;
  SELECT CASE WHEN NEW.conferidoEm IS NULL OR NEW.conferenteId IS NULL OR NEW.conferenteId = OLD.funcionarioId
    THEN RAISE(ABORT, 'A conferencia exige outro usuario identificado.') END;
  SELECT CASE WHEN NEW.quantidadeConferidaBoa IS NULL OR NEW.quantidadeConferidaRefugo IS NULL OR
    NEW.quantidadeConferidaBoa < 0 OR NEW.quantidadeConferidaBoa > OLD.quantidadeBoa OR
    NEW.quantidadeConferidaRefugo < 0 OR
    NEW.quantidadeConferidaBoa + NEW.quantidadeConferidaRefugo != OLD.quantidadeBoa + OLD.quantidadeRefugo
    THEN RAISE(ABORT, 'Confira o total declarado; boas rejeitadas devem virar perdas.') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "NestItem" i JOIN "NestCorte" n ON n.id = i.nestId
    JOIN "Funcionario" f ON f.id = NEW.conferenteId
    WHERE i.id = OLD.nestItemId AND n.status IN ('CONCLUIDO', 'CANCELADO') AND f.ativo = 1 AND
      f.papel = 'CONFERENTE' AND f.setorId = n.setorId
  ) THEN RAISE(ABORT, 'Finalize o corte e use um usuario autorizado a conferir.') END;
END;

CREATE TRIGGER "NestLancamento_apontar_conferencia" AFTER UPDATE OF "conferidoEm" ON "NestLancamento"
WHEN OLD.conferidoEm IS NULL AND NEW.conferidoEm IS NOT NULL
BEGIN
  INSERT INTO "Apontamento" (opId, setorId, funcionarioId, usuario, quantidadeBoa, quantidadeRefugo,
    dataHora, pecaId, processo, roteiroEtapaId, origem, maquinaId)
  SELECT i.opId, n.setorId, NEW.conferenteId, f.nome, NEW.quantidadeConferidaBoa, NEW.quantidadeConferidaRefugo,
    NEW.conferidoEm, i.pecaId, 'CORTE',
    (SELECT r.id FROM "PecaRoteiro" r WHERE r.pecaId = i.pecaId AND r.setorId = n.setorId AND r.processo = 'CORTE' ORDER BY r.ordem LIMIT 1),
    'NEST_CONFERIDO', n.maquinaId
  FROM "NestItem" i JOIN "NestCorte" n ON n.id = i.nestId JOIN "Funcionario" f ON f.id = NEW.conferenteId
  WHERE i.id = NEW.nestItemId;
  UPDATE "NestLancamento" SET apontamentoId = last_insert_rowid() WHERE id = NEW.id;
  INSERT INTO "NestEvento" (nestId, funcionarioId, tipo, descricao, dataHora)
  SELECT nestId, NEW.conferenteId, 'CONFERENCIA',
    'Lancamento ' || NEW.id || ': ' || NEW.quantidadeConferidaBoa || ' boas / ' || NEW.quantidadeConferidaRefugo || ' perdas. ' || COALESCE(NEW.motivoConferencia, ''),
    NEW.conferidoEm FROM "NestItem" WHERE id = NEW.nestItemId;
END;
