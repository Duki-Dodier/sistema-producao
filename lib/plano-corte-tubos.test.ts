import test from "node:test";
import assert from "node:assert/strict";
import { calcularPlanoCorteTubos, type DemandaCorteTubo } from "./plano-corte-tubos";

function demanda(parcial: Partial<DemandaCorteTubo> = {}): DemandaCorteTubo {
  return {
    opId: 1,
    opNumero: 1,
    lote: "LOTE-1",
    modeloCodigo: "MOD-1",
    pecaId: 1,
    pecaCodigo: "TB-1",
    pecaNome: "Tubo teste",
    perfilMm: 40,
    espessuraMm: 2,
    comprimentoMm: 1000,
    quantidade: 1,
    ...parcial,
  };
}

test("combina peças de OPs diferentes na mesma barra", () => {
  const resultado = calcularPlanoCorteTubos([
    demanda({ comprimentoMm: 3000 }),
    demanda({ opId: 2, opNumero: 2, pecaId: 2, pecaCodigo: "TB-2", comprimentoMm: 3000 }),
  ], { comprimentoBarraMm: 6000, perdaCorteMm: 0, refileInicialMm: 0 });
  assert.equal(resultado.indicadores.totalBarras, 1);
  assert.equal(resultado.indicadores.totalOps, 2);
  assert.equal(resultado.padroes[0].itens.length, 2);
});

test("considera perda da serra e refile na capacidade", () => {
  const resultado = calcularPlanoCorteTubos([
    demanda({ comprimentoMm: 2992, quantidade: 2 }),
  ], { comprimentoBarraMm: 6000, perdaCorteMm: 3, refileInicialMm: 10 });
  assert.equal(resultado.indicadores.totalBarras, 1);
  assert.equal(resultado.indicadores.perdaCortesTotalMm, 6);
  assert.equal(resultado.indicadores.refileTotalMm, 10);
  assert.equal(resultado.indicadores.sobraTotalMm, 0);
});

test("não mistura perfis nem espessuras diferentes", () => {
  const resultado = calcularPlanoCorteTubos([
    demanda({ quantidade: 2 }),
    demanda({ opId: 2, opNumero: 2, pecaId: 2, perfilMm: 50, quantidade: 2 }),
    demanda({ opId: 3, opNumero: 3, pecaId: 3, espessuraMm: 3, quantidade: 2 }),
  ], { comprimentoBarraMm: 6000, perdaCorteMm: 0, refileInicialMm: 0 });
  assert.equal(resultado.padroes.length, 3);
  assert.deepEqual(resultado.padroes.map((padrao) => `${padrao.perfilMm}x${padrao.espessuraMm}`), ["40x2", "40x3", "50x2"]);
});

test("agrupa receitas idênticas em um único padrão repetível", () => {
  const resultado = calcularPlanoCorteTubos([
    demanda({ comprimentoMm: 1000, quantidade: 12 }),
  ], { comprimentoBarraMm: 6000, perdaCorteMm: 0, refileInicialMm: 0 });
  assert.equal(resultado.indicadores.totalBarras, 2);
  assert.equal(resultado.indicadores.totalPadroes, 1);
  assert.equal(resultado.padroes[0].repeticoes, 2);
  assert.equal(resultado.padroes[0].itens[0].quantidadePorBarra, 6);
  assert.equal(resultado.padroes[0].itens[0].quantidadeTotal, 12);
});

test("o mesmo conjunto de entradas sempre produz o mesmo resultado", () => {
  const entradas = [
    demanda({ quantidade: 7, comprimentoMm: 1430 }),
    demanda({ opId: 2, opNumero: 2, pecaId: 2, pecaCodigo: "TB-2", quantidade: 5, comprimentoMm: 870 }),
  ];
  const parametros = { comprimentoBarraMm: 6000, perdaCorteMm: 3, refileInicialMm: 10 };
  assert.deepEqual(calcularPlanoCorteTubos(entradas, parametros), calcularPlanoCorteTubos(entradas, parametros));
});

test("bloqueia perfil fora dos três tamanhos permitidos", () => {
  const resultado = calcularPlanoCorteTubos([demanda({ perfilMm: 30 })]);
  assert.equal(resultado.padroes.length, 0);
  assert.match(resultado.erros[0], /não é suportado/);
});

test("bloqueia peça maior que o comprimento útil da barra", () => {
  const resultado = calcularPlanoCorteTubos([demanda({ comprimentoMm: 5990 })]);
  assert.equal(resultado.padroes.length, 0);
  assert.match(resultado.erros[0], /não cabe/);
});

test("recusa quantidade fracionada e medidas inválidas", () => {
  const resultado = calcularPlanoCorteTubos([
    demanda({ pecaCodigo: "QTD", quantidade: 1.5 }),
    demanda({ pecaId: 2, pecaCodigo: "ESP", espessuraMm: 0 }),
    demanda({ pecaId: 3, pecaCodigo: "COMP", comprimentoMm: Number.NaN }),
  ]);

  assert.equal(resultado.padroes.length, 0);
  assert.equal(resultado.erros.length, 3);
});
