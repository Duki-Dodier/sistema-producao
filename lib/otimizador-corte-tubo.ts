/**
 * Algoritmo de Otimização Linear 1D (1D Cutting Stock Problem) para Corte de Tubos.
 * Agrupa barras idênticas em PADRÕES DE CORTE (Cutting Patterns / Repetições),
 * gerando um plano enxuto para chão de fábrica e impressão sem repetição de dezenas de barras.
 */

export type ItemDemandaTubo = {
  opId: number;
  opNumero: number;
  lote: string;
  modeloCodigo: string;
  pecaId: number;
  pecaCodigo: string;
  pecaNome: string;
  comprimentoMm: number;
  quantidade: number; // quantidade restante a cortar
  perfil: string; // Ex: "Tubo Quadrado 40 × 40 × 3 mm"
  perfilA: number;
  perfilB: number | null;
  espessuraMm: number;
};

export type ParametrosOtimizacao = {
  comprimentoBarraMm: number; // padrão 6000 mm
  perdaCorteMm: number; // perda do disco/serra (kerf), padrão 3 mm
  refileInicialMm: number; // refile na ponta para esquadro, padrão 10 mm
};

export type ItemPadraoCorte = {
  opNumero: number;
  lote: string;
  modeloCodigo: string;
  pecaCodigo: string;
  pecaNome: string;
  comprimentoMm: number;
  quantidadePorBarra: number;
  quantidadeTotal: number; // quantidadePorBarra × totalDeBarrasDoPadrao
};

export type PadraoCorteBarra = {
  idPadrao: string; // ex: "P1", "P2"
  perfil: string;
  quantidadeBarras: number; // quantas barras de 6m repetir com essa receita
  numerosBarras: number[]; // ex: [1, 2, 3, 4, 5]
  comprimentoBarraMm: number;
  comprimentoUtilMm: number;
  perdaCortesMm: number;
  refileMm: number;
  sobraMm: number;
  sobraCm: number;
  sobraTotalLoteMm: number; // sobraMm × quantidadeBarras
  aproveitamentoPct: number;
  itens: ItemPadraoCorte[];
  receitaTexto: string; // Ex: "4× OP #10 (1.010 mm) + 1× OP #15 (1.400 mm)"
};

export type RomaneioOpItem = {
  opNumero: number;
  lote: string;
  modeloCodigo: string;
  pecaCodigo: string;
  pecaNome: string;
  comprimentoMm: number;
  quantidadeTotal: number;
};

export type PerfilOtimizado = {
  perfil: string;
  totalPecas: number;
  totalBarras6m: number;
  metrosPecasUtil: number;
  metrosBarrasTotal: number;
  metrosPerdaTotal: number;
  aproveitamentoMedioPct: number;
  padroes: PadraoCorteBarra[];
  romaneioOps: RomaneioOpItem[];
};

export type ResultadoOtimizacaoTubo = {
  perfis: PerfilOtimizado[];
  resumoGeral: {
    totalPerfis: number;
    totalOpsAtendidas: number;
    totalPadroesCorte: number;
    totalPecas: number;
    totalBarras6m: number;
    metrosUtilizados: number;
    metrosPerdaTotal: number;
    aproveitamentoMedioPct: number;
  };
};

/**
 * Executa a otimização de corte 1D e consolida em PADRÕES DE CORTE compactos.
 */
export function otimizarCorteTubos(
  demandas: ItemDemandaTubo[],
  parametros: ParametrosOtimizacao = {
    comprimentoBarraMm: 6000,
    perdaCorteMm: 3,
    refileInicialMm: 10,
  }
): ResultadoOtimizacaoTubo {
  const { comprimentoBarraMm, perdaCorteMm, refileInicialMm } = parametros;

  // 1. Agrupar demandas por perfil idêntico
  const gruposPorPerfil = new Map<string, ItemDemandaTubo[]>();
  for (const item of demandas) {
    if (item.quantidade <= 0 || item.comprimentoMm <= 0) continue;
    const lista = gruposPorPerfil.get(item.perfil) ?? [];
    lista.push(item);
    gruposPorPerfil.set(item.perfil, lista);
  }

  const perfisResultado: PerfilOtimizado[] = [];
  const opsUnicas = new Set<number>();
  let totalPadroesGeral = 0;

  for (const [perfil, itensDoPerfil] of gruposPorPerfil.entries()) {
    type UnidadeCorte = {
      opNumero: number;
      lote: string;
      modeloCodigo: string;
      pecaCodigo: string;
      pecaNome: string;
      comprimentoMm: number;
    };

    const pecasParaCortar: UnidadeCorte[] = [];
    const romaneioMap = new Map<string, RomaneioOpItem>();

    for (const item of itensDoPerfil) {
      opsUnicas.add(item.opNumero);
      for (let i = 0; i < item.quantidade; i++) {
        pecasParaCortar.push({
          opNumero: item.opNumero,
          lote: item.lote,
          modeloCodigo: item.modeloCodigo,
          pecaCodigo: item.pecaCodigo,
          pecaNome: item.pecaNome,
          comprimentoMm: item.comprimentoMm,
        });
      }

      const chaveRomaneio = `${item.opNumero}-${item.pecaCodigo}`;
      const romaneioExistente = romaneioMap.get(chaveRomaneio);
      if (romaneioExistente) {
        romaneioExistente.quantidadeTotal += item.quantidade;
      } else {
        romaneioMap.set(chaveRomaneio, {
          opNumero: item.opNumero,
          lote: item.lote,
          modeloCodigo: item.modeloCodigo,
          pecaCodigo: item.pecaCodigo,
          pecaNome: item.pecaNome,
          comprimentoMm: item.comprimentoMm,
          quantidadeTotal: item.quantidade,
        });
      }
    }

    if (pecasParaCortar.length === 0) continue;

    // Ordenar peças do maior para o menor comprimento (BFD)
    pecasParaCortar.sort((a, b) => b.comprimentoMm - a.comprimentoMm);

    type BarraConstruida = {
      pecas: UnidadeCorte[];
      espacoLivreMm: number;
    };

    const barrasIndividuais: BarraConstruida[] = [];
    const capacidadeUtil = comprimentoBarraMm - refileInicialMm;

    // Alocação gulosa Best-Fit Decreasing
    for (const peca of pecasParaCortar) {
      const custo = peca.comprimentoMm + perdaCorteMm;
      let melhorIdx = -1;
      let menorSobra = Infinity;

      for (let i = 0; i < barrasIndividuais.length; i++) {
        const livre = barrasIndividuais[i].espacoLivreMm;
        if (livre >= custo) {
          const sobra = livre - custo;
          if (sobra < menorSobra) {
            menorSobra = sobra;
            melhorIdx = i;
          }
        }
      }

      if (melhorIdx !== -1) {
        barrasIndividuais[melhorIdx].pecas.push(peca);
        barrasIndividuais[melhorIdx].espacoLivreMm -= custo;
      } else {
        barrasIndividuais.push({
          pecas: [peca],
          espacoLivreMm: capacidadeUtil - custo,
        });
      }
    }

    // 2. AGRUPAR BARRAS IDÊNTICAS EM "PADRÕES DE CORTE"
    // Cria uma assinatura única para a combinação de peças da barra
    type GrupoPadrao = {
      assinatura: string;
      pecasReceita: UnidadeCorte[];
      quantidadeBarras: number;
      numerosBarras: number[];
    };

    const mapaPadroes = new Map<string, GrupoPadrao>();

    barrasIndividuais.forEach((barra, indexBarra) => {
      // Ordenar peças dentro da barra para assinatura estável
      const pecasOrdenadas = [...barra.pecas].sort(
        (a, b) => a.opNumero - b.opNumero || b.comprimentoMm - a.comprimentoMm || a.pecaCodigo.localeCompare(b.pecaCodigo)
      );

      const assinatura = pecasOrdenadas.map((p) => `${p.opNumero}:${p.pecaCodigo}:${p.comprimentoMm}`).join("|");

      const existente = mapaPadroes.get(assinatura);
      if (existente) {
        existente.quantidadeBarras++;
        existente.numerosBarras.push(indexBarra + 1);
      } else {
        mapaPadroes.set(assinatura, {
          assinatura,
          pecasReceita: pecasOrdenadas,
          quantidadeBarras: 1,
          numerosBarras: [indexBarra + 1],
        });
      }
    });

    // Converter padrões agrupados em PadraoCorteBarra
    let metrosUtilPerfil = 0;
    let contadorPadrao = 1;

    const padroesCalculados: PadraoCorteBarra[] = Array.from(mapaPadroes.values())
      .sort((a, b) => b.quantidadeBarras - a.quantidadeBarras) // padrões com mais barras primeiro
      .map((gp) => {
        const idPadrao = `P${contadorPadrao++}`;
        const somaPecasBarra = gp.pecasReceita.reduce((acc, p) => acc + p.comprimentoMm, 0);
        const perdaCortesMm = gp.pecasReceita.length * perdaCorteMm;
        const sobraMm = Math.max(0, comprimentoBarraMm - (refileInicialMm + somaPecasBarra + perdaCortesMm));
        const sobraCm = Number((sobraMm / 10).toFixed(1));
        const aproveitamentoPct = Number(((somaPecasBarra / comprimentoBarraMm) * 100).toFixed(1));

        metrosUtilPerfil += (somaPecasBarra * gp.quantidadeBarras) / 1000;

        // Agrupar itens da receita
        const itensAgrupadosMap = new Map<string, ItemPadraoCorte>();
        for (const p of gp.pecasReceita) {
          const chave = `${p.opNumero}-${p.pecaCodigo}`;
          const itemExistente = itensAgrupadosMap.get(chave);
          if (itemExistente) {
            itemExistente.quantidadePorBarra++;
            itemExistente.quantidadeTotal += gp.quantidadeBarras;
          } else {
            itensAgrupadosMap.set(chave, {
              opNumero: p.opNumero,
              lote: p.lote,
              modeloCodigo: p.modeloCodigo,
              pecaCodigo: p.pecaCodigo,
              pecaNome: p.pecaNome,
              comprimentoMm: p.comprimentoMm,
              quantidadePorBarra: 1,
              quantidadeTotal: gp.quantidadeBarras,
            });
          }
        }

        const itensPadrao = Array.from(itensAgrupadosMap.values());
        const receitaTexto = itensPadrao
          .map((item) => `${item.quantidadePorBarra}× [OP #${item.opNumero} · ${item.comprimentoMm}mm]`)
          .join(" + ");

        return {
          idPadrao,
          perfil,
          quantidadeBarras: gp.quantidadeBarras,
          numerosBarras: gp.numerosBarras,
          comprimentoBarraMm,
          comprimentoUtilMm: somaPecasBarra,
          perdaCortesMm,
          refileMm: refileInicialMm,
          sobraMm: Number(sobraMm.toFixed(1)),
          sobraCm,
          sobraTotalLoteMm: Number((sobraMm * gp.quantidadeBarras).toFixed(1)),
          aproveitamentoPct,
          itens: itensPadrao,
          receitaTexto,
        };
      });

    totalPadroesGeral += padroesCalculados.length;
    const totalBarrasPerfil = barrasIndividuais.length;
    const metrosBarrasTotal = (totalBarrasPerfil * comprimentoBarraMm) / 1000;
    const metrosPerdaTotal = metrosBarrasTotal - metrosUtilPerfil;
    const aproveitamentoMedioPct =
      metrosBarrasTotal > 0 ? Number(((metrosUtilPerfil / metrosBarrasTotal) * 100).toFixed(1)) : 0;

    perfisResultado.push({
      perfil,
      totalPecas: pecasParaCortar.length,
      totalBarras6m: totalBarrasPerfil,
      metrosPecasUtil: Number(metrosUtilPerfil.toFixed(2)),
      metrosBarrasTotal: Number(metrosBarrasTotal.toFixed(2)),
      metrosPerdaTotal: Number(metrosPerdaTotal.toFixed(2)),
      aproveitamentoMedioPct,
      padroes: padroesCalculados,
      romaneioOps: Array.from(romaneioMap.values()).sort((a, b) => a.opNumero - b.opNumero),
    });
  }

  const totalPecas = perfisResultado.reduce((acc, p) => acc + p.totalPecas, 0);
  const totalBarras6m = perfisResultado.reduce((acc, p) => acc + p.totalBarras6m, 0);
  const metrosUtilizados = perfisResultado.reduce((acc, p) => acc + p.metrosPecasUtil, 0);
  const metrosPerdaTotal = perfisResultado.reduce((acc, p) => acc + p.metrosPerdaTotal, 0);
  const metrosBarrasTotal = (totalBarras6m * comprimentoBarraMm) / 1000;
  const aproveitamentoMedioPct =
    metrosBarrasTotal > 0 ? Number(((metrosUtilizados / metrosBarrasTotal) * 100).toFixed(1)) : 0;

  return {
    perfis: perfisResultado,
    resumoGeral: {
      totalPerfis: perfisResultado.length,
      totalOpsAtendidas: opsUnicas.size,
      totalPadroesCorte: totalPadroesGeral,
      totalPecas,
      totalBarras6m,
      metrosUtilizados: Number(metrosUtilizados.toFixed(2)),
      metrosPerdaTotal: Number(metrosPerdaTotal.toFixed(2)),
      aproveitamentoMedioPct,
    },
  };
}
