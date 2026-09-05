-- Um único usuário, lotado no Plasma Chapa, confere os NESTs de toda a área
-- Plasma (Chapa e Tubo). Nenhum apontamento novo do Plasma pode contornar a
-- conferência do NEST.
DROP TRIGGER IF EXISTS "NestLancamento_validar_conferencia";

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
    SELECT 1
    FROM "NestItem" i
    JOIN "NestCorte" n ON n.id = i.nestId
    JOIN "Setor" setorNest ON setorNest.id = n.setorId
    JOIN "Funcionario" f ON f.id = NEW.conferenteId
    JOIN "Setor" setorConferente ON setorConferente.id = f.setorId
    WHERE i.id = OLD.nestItemId
      AND n.status IN ('CONCLUIDO', 'CANCELADO')
      AND UPPER(TRIM(setorNest.nome)) IN ('PLASMA CHAPA', 'PLASMA TUBO')
      AND f.ativo = 1
      AND f.papel = 'CONFERENTE'
      AND UPPER(TRIM(setorConferente.nome)) = 'PLASMA CHAPA'
  ) THEN RAISE(ABORT, 'Finalize o corte e use o conferente designado do Plasma.') END;
END;

CREATE TRIGGER "Apontamento_exigir_conferencia_plasma" BEFORE INSERT ON "Apontamento"
WHEN COALESCE(NEW.origem, '') != 'NEST_CONFERIDO' AND EXISTS (
  SELECT 1 FROM "Setor" s
  WHERE s.id = NEW.setorId AND UPPER(TRIM(s.nome)) IN ('PLASMA CHAPA', 'PLASMA TUBO')
)
BEGIN
  SELECT RAISE(ABORT, 'No Plasma, o apontamento oficial exige conferencia do NEST.');
END;

PRAGMA optimize;
