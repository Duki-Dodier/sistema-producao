export const COMPRIMENTO_BARRA_TUBO_MM = 6000;
export const PERFIS_TUBO_SUPORTADOS = [40, 50, 60] as const;

export type DemandaCorteTubo = {
  opId: number;
  opNumero: number;
  lote: string;
  modeloCodigo: string;
  pecaId: number;
  pecaCodigo: string;
  pecaNome: string;
  perfilMm: number;
  espessuraMm: number;
  comprimentoMm: number;
  quantidade: number;
};

export type ParametrosCorteTubo = {
  comprimentoBarraMm: number;
  perdaCorteMm: number;
  refileInicialMm: number;
};

export type ItemPadraoCorteTubo = Omit<DemandaCorteTubo, "quantidade" | "perfilMm" | "espessuraMm"> & {
  quantidadePorBarra: number;
  quantidadeTotal: number;
};

export type PadraoCorteTubo = {
  codigo: string;
  ordem: number;
  perfilMm: number;
  espessuraMm: number;
  repeticoes: number;
  comprimentoBarraMm: number;
  comprimentoPecasPorBarraMm: number;
  perdaCortesPorBarraMm: number;
  refileInicialMm: number;
  sobraPorBarraMm: number;
  aproveitamentoPct: number;
  itens: ItemPadraoCorteTubo[];
};

export type ResultadoPlanoCorteTubo = {
  padroes: PadraoCorteTubo[];
  indicadores: {
    totalOps: number;
    totalPadroes: number;
    totalBarras: number;
    totalPecas: number;
    comprimentoPecasMm: number;
    perdaCortesTotalMm: number;
    refileTotalMm: number;
    sobraTotalMm: number;
    aproveitamentoPct: number;
  };
  erros: string[];
};

const ESCALA = 10;
const paraUnidade = (valor: number) => Math.round(valor * ESCALA);
const paraMm = (valor: number) => valor / ESCALA;

type UnidadeCorte = {
  demanda: DemandaCorteTubo;
  comprimentoU: number;
  consumoU: number;
  desempate: number;
};

type BarraInterna = {
  capacidadeU: number;
  restanteU: number;
  unidades: UnidadeCorte[];
};

function compararUnidades(a: UnidadeCorte, b: UnidadeCorte) {
  return b.consumoU - a.consumoU
    || a.demanda.opNumero - b.demanda.opNumero
    || a.demanda.lote.localeCompare(b.demanda.lote, "pt-BR")
    || a.demanda.pecaCodigo.localeCompare(b.demanda.pecaCodigo, "pt-BR")
    || a.desempate - b.desempate;
}

function selecionarCombinacao(unidades: UnidadeCorte[], capacidadeU: number) {
  const candidatas = unidades.slice(0, 64);
  let estados = new Map<number, number[]>([[0, []]]);

  candidatas.forEach((item, indice) => {
    const novos = new Map(estados);
    for (const [soma, selecionados] of estados) {
      const proxima = soma + item.consumoU;
      if (proxima <= capacidadeU && !novos.has(proxima)) {
        novos.set(proxima, [...selecionados, indice]);
      }
    }
    if (novos.size > 1400) {
      estados = new Map([...novos.entries()].sort(([a], [b]) => b - a).slice(0, 1400));
      estados.set(0, []);
    } else {
      estados = novos;
    }
  });

  const melhor = [...estados.entries()].sort(([a], [b]) => b - a)[0]?.[1] ?? [];
  return melhor.map((indice) => candidatas[indice]);
}

function consolidarBarras(barras: BarraInterna[]) {
  let alterou = true;
  while (alterou) {
    alterou = false;
    const origens = [...barras].sort((a, b) => a.unidades.length - b.unidades.length || b.restanteU - a.restanteU);
    for (const origem of origens) {
      if (barras.length <= 1) break;
      const destinos = barras.filter((barra) => barra !== origem);
      const saldos = new Map(destinos.map((barra) => [barra, barra.restanteU]));
      const movimentos: Array<{ unidade: UnidadeCorte; destino: BarraInterna }> = [];
      for (const unidade of [...origem.unidades].sort(compararUnidades)) {
        const destino = destinos
          .filter((barra) => (saldos.get(barra) ?? 0) >= unidade.consumoU)
          .sort((a, b) => ((saldos.get(a) ?? 0) - unidade.consumoU) - ((saldos.get(b) ?? 0) - unidade.consumoU))[0];
        if (!destino) {
          movimentos.length = 0;
          break;
        }
        movimentos.push({ unidade, destino });
        saldos.set(destino, (saldos.get(destino) ?? 0) - unidade.consumoU);
      }
      if (movimentos.length !== origem.unidades.length) continue;
      for (const movimento of movimentos) movimento.destino.unidades.push(movimento.unidade);
      for (const destino of destinos) destino.restanteU = saldos.get(destino) ?? destino.restanteU;
      barras.splice(barras.indexOf(origem), 1);
      alterou = true;
      break;
    }
  }
  return barras;
}

function empacotarDinamico(unidadesOriginais: UnidadeCorte[], capacidadeU: number) {
  const restantes = [...unidadesOriginais].sort(compararUnidades);
  const barras: BarraInterna[] = [];
  while (restantes.length) {
    let combinacao = selecionarCombinacao(restantes, capacidadeU);
    if (!combinacao.length) combinacao = [restantes[0]];
    const barra: BarraInterna = { capacidadeU, restanteU: capacidadeU, unidades: [] };
    for (const unidade of combinacao) {
      const indice = restantes.indexOf(unidade);
      if (indice < 0) continue;
      restantes.splice(indice, 1);
      barra.unidades.push(unidade);
      barra.restanteU -= unidade.consumoU;
    }
    barras.push(barra);
  }
  return consolidarBarras(barras);
}

function empacotarAjuste(unidadesOriginais: UnidadeCorte[], capacidadeU: number, melhorAjuste: boolean) {
  const barras: BarraInterna[] = [];
  for (const unidade of [...unidadesOriginais].sort(compararUnidades)) {
    const candidatas = barras.filter((barra) => unidade.consumoU <= barra.restanteU);
    const barra = melhorAjuste
      ? candidatas.sort((a, b) => (a.restanteU - unidade.consumoU) - (b.restanteU - unidade.consumoU))[0]
      : candidatas[0];
    if (barra) {
      barra.unidades.push(unidade);
      barra.restanteU -= unidade.consumoU;
    } else {
      barras.push({ capacidadeU, restanteU: capacidadeU - unidade.consumoU, unidades: [unidade] });
    }
  }
  return consolidarBarras(barras);
}

function pontuarBarras(barras: BarraInterna[]) {
  const sobrasOrdenadas = barras.map((barra) => barra.restanteU).sort((a, b) => b - a);
  return {
    quantidade: barras.length,
    sobraTotal: sobrasOrdenadas.reduce((total, sobra) => total + sobra, 0),
    maiorSobra: sobrasOrdenadas[0] ?? 0,
    dispersao: sobrasOrdenadas.reduce((total, sobra) => total + sobra * sobra, 0),
  };
}

function escolherMelhor(solucoes: BarraInterna[][]) {
  return solucoes.sort((a, b) => {
    const pa = pontuarBarras(a);
    const pb = pontuarBarras(b);
    return pa.quantidade - pb.quantidade
      || pa.sobraTotal - pb.sobraTotal
      || pa.maiorSobra - pb.maiorSobra
      || pa.dispersao - pb.dispersao;
  })[0] ?? [];
}

function assinaturaBarra(barra: BarraInterna) {
  return [...barra.unidades]
    .sort(compararUnidades)
    .map((unidade) => `${unidade.demanda.opId}:${unidade.demanda.pecaId}:${unidade.comprimentoU}`)
    .join("|");
}

function agruparPadroes(
  grupos: Array<{ perfilMm: number; espessuraMm: number; barras: BarraInterna[] }>,
  parametros: ParametrosCorteTubo,
) {
  const agrupados: Array<{ perfilMm: number; espessuraMm: number; barra: BarraInterna; repeticoes: number }> = [];
  for (const grupo of grupos) {
    const mapa = new Map<string, { barra: BarraInterna; repeticoes: number }>();
    for (const barra of grupo.barras) {
      const chave = assinaturaBarra(barra);
      const existente = mapa.get(chave);
      if (existente) existente.repeticoes += 1;
      else mapa.set(chave, { barra, repeticoes: 1 });
    }
    for (const valor of mapa.values()) agrupados.push({ ...grupo, ...valor });
  }

  agrupados.sort((a, b) => a.perfilMm - b.perfilMm
    || a.espessuraMm - b.espessuraMm
    || b.repeticoes - a.repeticoes
    || a.barra.restanteU - b.barra.restanteU
    || assinaturaBarra(a.barra).localeCompare(assinaturaBarra(b.barra)));

  return agrupados.map((grupo, indice): PadraoCorteTubo => {
    const itensMap = new Map<string, ItemPadraoCorteTubo>();
    for (const unidade of [...grupo.barra.unidades].sort(compararUnidades)) {
      const demanda = unidade.demanda;
      const chave = `${demanda.opId}:${demanda.pecaId}`;
      const atual = itensMap.get(chave);
      if (atual) {
        atual.quantidadePorBarra += 1;
        atual.quantidadeTotal += grupo.repeticoes;
      } else {
        itensMap.set(chave, {
          opId: demanda.opId,
          opNumero: demanda.opNumero,
          lote: demanda.lote,
          modeloCodigo: demanda.modeloCodigo,
          pecaId: demanda.pecaId,
          pecaCodigo: demanda.pecaCodigo,
          pecaNome: demanda.pecaNome,
          comprimentoMm: demanda.comprimentoMm,
          quantidadePorBarra: 1,
          quantidadeTotal: grupo.repeticoes,
        });
      }
    }
    const comprimentoPecas = grupo.barra.unidades.reduce((total, item) => total + item.comprimentoU, 0);
    const perdas = grupo.barra.unidades.length * paraUnidade(parametros.perdaCorteMm);
    return {
      codigo: `P${String(indice + 1).padStart(2, "0")}`,
      ordem: indice + 1,
      perfilMm: grupo.perfilMm,
      espessuraMm: grupo.espessuraMm,
      repeticoes: grupo.repeticoes,
      comprimentoBarraMm: parametros.comprimentoBarraMm,
      comprimentoPecasPorBarraMm: paraMm(comprimentoPecas),
      perdaCortesPorBarraMm: paraMm(perdas),
      refileInicialMm: parametros.refileInicialMm,
      sobraPorBarraMm: paraMm(grupo.barra.restanteU),
      aproveitamentoPct: Number(((paraMm(comprimentoPecas) / parametros.comprimentoBarraMm) * 100).toFixed(2)),
      itens: [...itensMap.values()],
    };
  });
}

export function calcularPlanoCorteTubos(
  demandas: DemandaCorteTubo[],
  parametros: ParametrosCorteTubo = {
    comprimentoBarraMm: COMPRIMENTO_BARRA_TUBO_MM,
    perdaCorteMm: 3,
    refileInicialMm: 10,
  },
): ResultadoPlanoCorteTubo {
  const erros: string[] = [];
  if (parametros.comprimentoBarraMm !== COMPRIMENTO_BARRA_TUBO_MM) erros.push("A barra deve ter exatamente 6.000 mm.");
  if (!Number.isFinite(parametros.perdaCorteMm) || parametros.perdaCorteMm < 0 || parametros.perdaCorteMm > 20) erros.push("A perda por corte deve estar entre 0 e 20 mm.");
  if (!Number.isFinite(parametros.refileInicialMm) || parametros.refileInicialMm < 0 || parametros.refileInicialMm > 200) erros.push("O refile inicial deve estar entre 0 e 200 mm.");

  const capacidadeU = paraUnidade(parametros.comprimentoBarraMm - parametros.refileInicialMm);
  const grupos = new Map<string, DemandaCorteTubo[]>();
  for (const demanda of demandas) {
    if (!Number.isInteger(demanda.quantidade) || demanda.quantidade <= 0) {
      erros.push(`${demanda.pecaCodigo}: a quantidade deve ser um número inteiro positivo.`);
      continue;
    }
    if (!PERFIS_TUBO_SUPORTADOS.includes(demanda.perfilMm as (typeof PERFIS_TUBO_SUPORTADOS)[number])) {
      erros.push(`${demanda.pecaCodigo}: perfil ${demanda.perfilMm} × ${demanda.perfilMm} não é suportado.`);
      continue;
    }
    if (!Number.isFinite(demanda.espessuraMm) || demanda.espessuraMm <= 0) {
      erros.push(`${demanda.pecaCodigo}: espessura inválida.`);
      continue;
    }
    if (!Number.isFinite(demanda.comprimentoMm) || demanda.comprimentoMm <= 0) {
      erros.push(`${demanda.pecaCodigo}: comprimento inválido.`);
      continue;
    }
    const chave = `${paraUnidade(demanda.perfilMm)}:${paraUnidade(demanda.espessuraMm)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), demanda]);
  }

  const gruposCalculados: Array<{ perfilMm: number; espessuraMm: number; barras: BarraInterna[] }> = [];
  for (const demandasPerfil of grupos.values()) {
    const unidades: UnidadeCorte[] = [];
    let desempate = 0;
    for (const demanda of demandasPerfil) {
      const comprimentoU = paraUnidade(demanda.comprimentoMm);
      const consumoU = paraUnidade(demanda.comprimentoMm + parametros.perdaCorteMm);
      if (comprimentoU <= 0 || consumoU > capacidadeU) {
        erros.push(`${demanda.pecaCodigo}: ${demanda.comprimentoMm.toLocaleString("pt-BR")} mm não cabe na barra útil.`);
        continue;
      }
      for (let i = 0; i < demanda.quantidade; i++) unidades.push({ demanda, comprimentoU, consumoU, desempate: desempate++ });
    }
    if (!unidades.length) continue;
    const barras = escolherMelhor([
      empacotarDinamico(unidades, capacidadeU),
      empacotarAjuste(unidades, capacidadeU, true),
      empacotarAjuste(unidades, capacidadeU, false),
    ]);
    gruposCalculados.push({
      perfilMm: demandasPerfil[0].perfilMm,
      espessuraMm: demandasPerfil[0].espessuraMm,
      barras,
    });
  }

  const padroes = agruparPadroes(gruposCalculados, parametros);
  const totalBarras = padroes.reduce((total, padrao) => total + padrao.repeticoes, 0);
  const totalPecas = padroes.reduce((total, padrao) => total + padrao.itens.reduce((subtotal, item) => subtotal + item.quantidadeTotal, 0), 0);
  const comprimentoPecasMm = padroes.reduce((total, padrao) => total + padrao.comprimentoPecasPorBarraMm * padrao.repeticoes, 0);
  const perdaCortesTotalMm = totalPecas * parametros.perdaCorteMm;
  const refileTotalMm = totalBarras * parametros.refileInicialMm;
  const sobraTotalMm = padroes.reduce((total, padrao) => total + padrao.sobraPorBarraMm * padrao.repeticoes, 0);
  const estoqueTotalMm = totalBarras * parametros.comprimentoBarraMm;

  return {
    padroes,
    indicadores: {
      totalOps: new Set(padroes.flatMap((padrao) => padrao.itens.map((item) => item.opId))).size,
      totalPadroes: padroes.length,
      totalBarras,
      totalPecas,
      comprimentoPecasMm,
      perdaCortesTotalMm,
      refileTotalMm,
      sobraTotalMm,
      aproveitamentoPct: estoqueTotalMm > 0 ? Number(((comprimentoPecasMm / estoqueTotalMm) * 100).toFixed(2)) : 0,
    },
    erros: [...new Set(erros)],
  };
}

export async function hashSnapshotPlanoCorteTubos(demandas: DemandaCorteTubo[], parametros: ParametrosCorteTubo) {
  const normalizado = JSON.stringify({
    parametros,
    demandas: [...demandas]
      .sort((a, b) => a.opId - b.opId || a.pecaId - b.pecaId)
      .map((item) => [item.opId, item.opNumero, item.lote, item.modeloCodigo, item.pecaId, item.pecaCodigo, item.perfilMm, item.espessuraMm, item.comprimentoMm, item.quantidade]),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizado));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
