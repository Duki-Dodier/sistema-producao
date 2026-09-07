export type DemandaCorteTubo = {
  opId: number;
  opNumero: number;
  lote: string;
  modelo: string;
  pecaId: number;
  pecaCodigo: string;
  pecaNome: string;
  quantidade: number;
  comprimentoMm: number;
  perfilA: number;
  perfilB: number | null;
  espessuraMm: number;
};

export type SobraDisponivelTubo = {
  id: number;
  codigo: string;
  comprimentoMm: number;
  perfilA: number;
  perfilB: number | null;
  espessuraMm: number;
};

export type ParametrosPlanoCorteTubo = {
  comprimentoBarraMm: number;
  perdaCorteMm: number;
  margemInicialMm: number;
  margemFinalMm: number;
  minimoSobraMm: number;
};

export type ItemBarraPlanoTubo = Omit<DemandaCorteTubo, "quantidade"> & {
  quantidade: number;
  consumoTotalMm: number;
};

export type BarraPlanoTubo = {
  ordem: number;
  chavePerfil: string;
  perfilA: number;
  perfilB: number | null;
  espessuraMm: number;
  origem: "NOVA" | "SOBRA";
  sobraOrigemId: number | null;
  sobraOrigemCodigo: string | null;
  comprimentoOrigemMm: number;
  comprimentoConsumidoMm: number;
  sobraPrevistaMm: number;
  aproveitamentoPct: number;
  itens: ItemBarraPlanoTubo[];
};

export type ResultadoPlanoCorteTubo = {
  barras: BarraPlanoTubo[];
  indicadores: {
    opsAtendidas: number;
    pecasProgramadas: number;
    barrasNovas: number;
    sobrasReaproveitadas: number;
    metrosUtilizados: number;
    desperdicioMm: number;
    sobraReutilizavelMm: number;
    perdaCortesMm: number;
    aproveitamentoPct: number;
  };
  erros: string[];
};

const UNIDADE = 10;
const u = (valor: number) => Math.round(valor * UNIDADE);
const mm = (valor: number) => valor / UNIDADE;
const n = (valor: number | null) => (valor === null ? "-" : u(valor).toString());

export function chavePerfilTubo(perfilA: number, perfilB: number | null, espessuraMm: number) {
  return `${u(perfilA)}x${n(perfilB)}x${u(espessuraMm)}`;
}

export function nomePerfilTubo(perfilA: number, perfilB: number | null, espessuraMm: number) {
  const secao = perfilB === null ? `Ø ${perfilA}` : `${perfilA} × ${perfilB}`;
  return `${secao} × ${espessuraMm} mm`;
}

type UnidadeCorte = Omit<DemandaCorteTubo, "quantidade"> & { consumoU: number; comprimentoU: number };
type BarraInterna = {
  perfilA: number;
  perfilB: number | null;
  espessuraMm: number;
  origem: "NOVA" | "SOBRA";
  sobraOrigemId: number | null;
  sobraOrigemCodigo: string | null;
  comprimentoOrigemU: number;
  capacidadeU: number;
  restanteU: number;
  unidades: UnidadeCorte[];
};

function compararUnidades(a: UnidadeCorte, b: UnidadeCorte) {
  return b.consumoU - a.consumoU || a.opNumero - b.opNumero || a.pecaCodigo.localeCompare(b.pecaCodigo);
}

/** Programação dinâmica com poda: encontra uma combinação muito próxima da capacidade sem explodir a memória do Worker. */
function selecionarCombinacao(unidades: UnidadeCorte[], capacidadeU: number) {
  const limiteItens = 48;
  const candidatas = unidades.slice(0, limiteItens);
  let estados = new Map<number, number[]>([[0, []]]);
  candidatas.forEach((item, indice) => {
    const novos = new Map(estados);
    for (const [soma, selecionados] of estados) {
      const proxima = soma + item.consumoU;
      if (proxima <= capacidadeU && !novos.has(proxima)) novos.set(proxima, [...selecionados, indice]);
    }
    if (novos.size > 900) {
      estados = new Map([...novos.entries()].sort(([a], [b]) => b - a).slice(0, 900));
      estados.set(0, []);
    } else estados = novos;
  });
  const melhor = [...estados.entries()].sort(([a], [b]) => b - a)[0]?.[1] ?? [];
  return melhor.map((indice) => candidatas[indice]);
}

function empacotar(
  unidadesOriginais: UnidadeCorte[],
  sobras: SobraDisponivelTubo[],
  parametros: ParametrosPlanoCorteTubo,
  modo: "MELHOR_AJUSTE" | "PRIMEIRO_AJUSTE",
) {
  const margemU = u(parametros.margemInicialMm + parametros.margemFinalMm);
  const unidades = [...unidadesOriginais].sort(compararUnidades);
  const barras: BarraInterna[] = [];
  const sobrasOrdenadas = [...sobras].sort((a, b) => a.comprimentoMm - b.comprimentoMm || a.id - b.id);

  for (const sobra of sobrasOrdenadas) {
    const capacidadeU = u(sobra.comprimentoMm) - margemU;
    if (capacidadeU <= 0 || !unidades.some((item) => item.consumoU <= capacidadeU)) continue;
    const barra: BarraInterna = {
      perfilA: sobra.perfilA,
      perfilB: sobra.perfilB,
      espessuraMm: sobra.espessuraMm,
      origem: "SOBRA",
      sobraOrigemId: sobra.id,
      sobraOrigemCodigo: sobra.codigo,
      comprimentoOrigemU: u(sobra.comprimentoMm),
      capacidadeU,
      restanteU: capacidadeU,
      unidades: [],
    };
    const combinacao = selecionarCombinacao(unidades, barra.restanteU);
    for (const item of combinacao) {
      unidades.splice(unidades.indexOf(item), 1);
      barra.unidades.push(item);
      barra.restanteU -= item.consumoU;
    }
    barras.push(barra);
  }

  const capacidadeNovaU = u(parametros.comprimentoBarraMm) - margemU;
  if (modo === "MELHOR_AJUSTE") {
    while (unidades.length) {
      const combinacao = selecionarCombinacao(unidades, capacidadeNovaU);
      if (!combinacao.length) break;
      const referencia = combinacao[0];
      const barra: BarraInterna = {
        perfilA: referencia.perfilA, perfilB: referencia.perfilB, espessuraMm: referencia.espessuraMm,
        origem: "NOVA", sobraOrigemId: null, sobraOrigemCodigo: null,
        comprimentoOrigemU: u(parametros.comprimentoBarraMm), capacidadeU: capacidadeNovaU,
        restanteU: capacidadeNovaU, unidades: [],
      };
      for (const item of combinacao) {
        unidades.splice(unidades.indexOf(item), 1);
        barra.unidades.push(item);
        barra.restanteU -= item.consumoU;
      }
      barras.push(barra);
    }
  }
  for (const item of [...unidades]) {
    const candidatas = barras.filter((barra) => barra.origem === "NOVA" && item.consumoU <= barra.restanteU);
    let barra = modo === "PRIMEIRO_AJUSTE"
      ? candidatas[0]
      : candidatas.sort((a, b) => (a.restanteU - item.consumoU) - (b.restanteU - item.consumoU))[0];
    if (!barra) {
      barra = {
        perfilA: item.perfilA,
        perfilB: item.perfilB,
        espessuraMm: item.espessuraMm,
        origem: "NOVA",
        sobraOrigemId: null,
        sobraOrigemCodigo: null,
        comprimentoOrigemU: u(parametros.comprimentoBarraMm),
        capacidadeU: capacidadeNovaU,
        restanteU: capacidadeNovaU,
        unidades: [],
      };
      barras.push(barra);
    }
    barra.unidades.push(item);
    barra.restanteU -= item.consumoU;
  }

  // Consolida barras pouco ocupadas quando todos os seus cortes cabem nas demais.
  for (const origem of [...barras].sort((a, b) => a.unidades.length - b.unidades.length)) {
    if (origem.origem !== "NOVA") continue;
    const destinos = barras.filter((barra) => barra !== origem);
    const movimentos: Array<{ item: UnidadeCorte; destino: BarraInterna }> = [];
    const saldos = new Map(destinos.map((barra) => [barra, barra.restanteU]));
    for (const item of [...origem.unidades].sort(compararUnidades)) {
      const destino = destinos
        .filter((barra) => (saldos.get(barra) ?? 0) >= item.consumoU)
        .sort((a, b) => ((saldos.get(a) ?? 0) - item.consumoU) - ((saldos.get(b) ?? 0) - item.consumoU))[0];
      if (!destino) { movimentos.length = 0; break; }
      movimentos.push({ item, destino });
      saldos.set(destino, (saldos.get(destino) ?? 0) - item.consumoU);
    }
    if (movimentos.length !== origem.unidades.length) continue;
    for (const movimento of movimentos) movimento.destino.unidades.push(movimento.item);
    for (const destino of destinos) destino.restanteU = saldos.get(destino) ?? destino.restanteU;
    barras.splice(barras.indexOf(origem), 1);
  }
  return barras;
}

function pontuar(barras: BarraInterna[], minimoSobraU: number) {
  const novas = barras.filter((barra) => barra.origem === "NOVA").length;
  const descarte = barras.reduce((total, barra) => total + (barra.restanteU < minimoSobraU ? barra.restanteU : 0), 0);
  return novas * 1_000_000_000 + descarte;
}

export function calcularPlanoCorteTubo(
  demandas: DemandaCorteTubo[],
  sobras: SobraDisponivelTubo[],
  parametros: ParametrosPlanoCorteTubo,
): ResultadoPlanoCorteTubo {
  const erros: string[] = [];
  const comprimentoUtilU = u(parametros.comprimentoBarraMm - parametros.margemInicialMm - parametros.margemFinalMm);
  if (comprimentoUtilU <= 0) erros.push("As margens ocupam todo o comprimento da barra.");
  if (parametros.perdaCorteMm < 0 || parametros.minimoSobraMm < 0) erros.push("Os parâmetros não podem ser negativos.");

  const grupos = new Map<string, DemandaCorteTubo[]>();
  for (const demanda of demandas) {
    const chave = chavePerfilTubo(demanda.perfilA, demanda.perfilB, demanda.espessuraMm);
    grupos.set(chave, [...(grupos.get(chave) ?? []), demanda]);
  }

  const internas: BarraInterna[] = [];
  for (const [chave, grupo] of [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const unidades: UnidadeCorte[] = grupo.flatMap((demanda) =>
      Array.from({ length: demanda.quantidade }, () => ({
        ...demanda,
        quantidade: undefined,
        comprimentoU: u(demanda.comprimentoMm),
        consumoU: u(demanda.comprimentoMm + parametros.perdaCorteMm),
      })) as UnidadeCorte[],
    );
    for (const item of unidades) {
      if (item.consumoU > comprimentoUtilU) erros.push(`${item.pecaCodigo}: ${mm(item.comprimentoU)} mm não cabe na barra útil.`);
    }
    const validas = unidades.filter((item) => item.consumoU <= comprimentoUtilU);
    const sobrasPerfil = sobras.filter((sobra) => chavePerfilTubo(sobra.perfilA, sobra.perfilB, sobra.espessuraMm) === chave);
    const solucoes = [
      empacotar(validas, sobrasPerfil, parametros, "MELHOR_AJUSTE"),
      empacotar(validas, sobrasPerfil, parametros, "PRIMEIRO_AJUSTE"),
    ];
    internas.push(...solucoes.sort((a, b) => pontuar(a, u(parametros.minimoSobraMm)) - pontuar(b, u(parametros.minimoSobraMm)))[0]);
  }

  const barras: BarraPlanoTubo[] = internas.map((barra, indice) => {
    const itens: ItemBarraPlanoTubo[] = [];
    for (const item of barra.unidades) {
      const anterior = itens.at(-1);
      if (anterior && anterior.opId === item.opId && anterior.pecaId === item.pecaId) {
        anterior.quantidade++;
        anterior.consumoTotalMm += mm(item.consumoU);
      } else {
        itens.push({
          opId: item.opId, opNumero: item.opNumero, lote: item.lote, modelo: item.modelo,
          pecaId: item.pecaId, pecaCodigo: item.pecaCodigo, pecaNome: item.pecaNome,
          comprimentoMm: mm(item.comprimentoU), perfilA: item.perfilA, perfilB: item.perfilB,
          espessuraMm: item.espessuraMm, quantidade: 1, consumoTotalMm: mm(item.consumoU),
        });
      }
    }
    const consumidoU = barra.capacidadeU - barra.restanteU;
    return {
      ordem: indice + 1,
      chavePerfil: chavePerfilTubo(barra.perfilA, barra.perfilB, barra.espessuraMm),
      perfilA: barra.perfilA, perfilB: barra.perfilB, espessuraMm: barra.espessuraMm,
      origem: barra.origem, sobraOrigemId: barra.sobraOrigemId, sobraOrigemCodigo: barra.sobraOrigemCodigo,
      comprimentoOrigemMm: mm(barra.comprimentoOrigemU), comprimentoConsumidoMm: mm(consumidoU),
      sobraPrevistaMm: mm(barra.restanteU),
      aproveitamentoPct: barra.capacidadeU > 0 ? Number(((consumidoU / barra.capacidadeU) * 100).toFixed(2)) : 0,
      itens,
    };
  });

  const pecasProgramadas = demandas.reduce((total, item) => total + item.quantidade, 0);
  const comprimentoPecasMm = demandas.reduce((total, item) => total + item.quantidade * item.comprimentoMm, 0);
  const origemTotalMm = barras.reduce((total, barra) => total + barra.comprimentoOrigemMm, 0);
  const perdaCortesMm = pecasProgramadas * parametros.perdaCorteMm;
  const sobraReutilizavelMm = barras.reduce((total, barra) => total + (barra.sobraPrevistaMm >= parametros.minimoSobraMm ? barra.sobraPrevistaMm : 0), 0);
  const desperdicioMm = barras.reduce((total, barra) => total + (barra.sobraPrevistaMm < parametros.minimoSobraMm ? barra.sobraPrevistaMm : 0), 0);
  return {
    barras,
    indicadores: {
      opsAtendidas: new Set(demandas.map((item) => item.opId)).size,
      pecasProgramadas,
      barrasNovas: barras.filter((barra) => barra.origem === "NOVA").length,
      sobrasReaproveitadas: barras.filter((barra) => barra.origem === "SOBRA").length,
      metrosUtilizados: Number((comprimentoPecasMm / 1000).toFixed(2)),
      desperdicioMm, sobraReutilizavelMm, perdaCortesMm,
      aproveitamentoPct: origemTotalMm > 0 ? Number(((comprimentoPecasMm / origemTotalMm) * 100).toFixed(2)) : 0,
    },
    erros: [...new Set(erros)],
  };
}
