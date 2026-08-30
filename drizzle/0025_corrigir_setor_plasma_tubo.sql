-- Os itens informados como PLASMA TUBO devem permanecer nesse setor,
-- inclusive quando a descrição da peça é apenas "TUBO".
UPDATE "Peca" SET "setorId"=4 WHERE "codigo" IN ('BY1009-CB1', 'DG1004-TB');

DELETE FROM "PecaRoteiro"
WHERE "pecaId" IN (SELECT "id" FROM "Peca" WHERE "codigo" IN ('BY1009-CB1', 'DG1004-TB'));
INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem")
SELECT "id", 4, 'CORTE', 1 FROM "Peca" WHERE "codigo" IN ('BY1009-CB1', 'DG1004-TB');
INSERT INTO "PecaRoteiro" ("pecaId", "setorId", "processo", "ordem")
SELECT "id", 9, 'AGRUPAR', 2 FROM "Peca" WHERE "codigo" IN ('BY1009-CB1', 'DG1004-TB');

DELETE FROM "ModeloRoteiro"
WHERE "modeloId" IN (SELECT "id" FROM "Modelo" WHERE "codigo" IN ('BY1009', 'DG1004'));
INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT "id", 2, 1 FROM "Modelo" WHERE "codigo" IN ('BY1009', 'DG1004');
INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT "id", 3, 2 FROM "Modelo" WHERE "codigo" IN ('BY1009', 'DG1004');
INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT "id", 4, 3 FROM "Modelo" WHERE "codigo" IN ('BY1009', 'DG1004');
INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT "id", 9, 4 FROM "Modelo" WHERE "codigo" IN ('BY1009', 'DG1004');
INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT "id", 1, 5 FROM "Modelo" WHERE "codigo" IN ('BY1009', 'DG1004');
INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT "id", 7, 6 FROM "Modelo" WHERE "codigo" IN ('BY1009', 'DG1004');
INSERT INTO "ModeloRoteiro" ("modeloId", "setorId", "ordem")
SELECT "id", 6, 7 FROM "Modelo" WHERE "codigo" IN ('BY1009', 'DG1004');
