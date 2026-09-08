"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuarioLogado } from "@/lib/auth-operador";
import { registrarAlteracao } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { buscarDemandasSelecionadasPlanoCorteTubos } from "@/lib/plano-corte-tubos-dados";
import {
  calcularPlanoCorteTubos,
  COMPRIMENTO_BARRA_TUBO_MM,
  hashSnapshotPlanoCorteTubos,
  type ParametrosCorteTubo,
} from "@/lib/plano-corte-tubos";

export type ResultadoEmissaoPlanoCorteTubos =
  | { ok: true; id: number; mensagem: string }
  | { ok: false; mensagem: string };

function numero(formData: FormData, campo: string, minimo: number, maximo: number) {
  const valor = Number(String(formData.get(campo) ?? "").replace(",", "."));
  if (!Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new Error(`${campo} deve estar entre ${minimo} e ${maximo} mm.`);
  }
  return valor;
}

function idsSelecionados(formData: FormData) {
  return formData.getAll("opId").map(Number).filter((id) => Number.isInteger(id) && id > 0);
}

function codigoPlano() {
  const agora = new Date();
  const data = agora.toISOString().slice(0, 10).replaceAll("-", "");
  const hora = agora.toISOString().slice(11, 16).replace(":", "");
  return `PCT-${data}-${hora}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function emitirPlanoCorteTubos(
  _anterior: ResultadoEmissaoPlanoCorteTubos | null,
  formData: FormData,
): Promise<ResultadoEmissaoPlanoCorteTubos> {
  let planoCriadoId: number | null = null;
  try {
    const usuario = await exigirUsuarioLogado();
    if (!usuario.administrador && usuario.papel !== "PCP") {
      throw new Error("Somente o PCP ou um administrador pode emitir este plano.");
    }

    const opsIds = idsSelecionados(formData);
    if (!opsIds.length) throw new Error("Selecione pelo menos uma OP apta.");
    const parametros: ParametrosCorteTubo = {
      comprimentoBarraMm: COMPRIMENTO_BARRA_TUBO_MM,
      perdaCorteMm: numero(formData, "perdaCorteMm", 0, 20),
      refileInicialMm: numero(formData, "refileInicialMm", 0, 200),
    };

    const { demandas } = await buscarDemandasSelecionadasPlanoCorteTubos(opsIds);
    if (!demandas.length) throw new Error("As OPs selecionadas não possuem demanda pendente de corte.");
    const calculo = calcularPlanoCorteTubos(demandas, parametros);
    if (calculo.erros.length) throw new Error(calculo.erros[0]);
    if (!calculo.padroes.length) throw new Error("Não foi possível formar nenhum padrão de corte.");

    const snapshotHash = await hashSnapshotPlanoCorteTubos(demandas, parametros);
    const plano = await prisma.planoCorteTubo.create({
      data: {
        codigo: codigoPlano(),
        criadoPorId: usuario.id,
        ...parametros,
        snapshotHash,
        ...calculo.indicadores,
      },
      select: { id: true, codigo: true },
    });
    planoCriadoId = plano.id;

    const padroesCriados = await prisma.$transaction(
      calculo.padroes.map((padrao) => prisma.planoCorteTuboPadrao.create({
        data: {
          planoId: plano.id,
          ordem: padrao.ordem,
          codigo: padrao.codigo,
          perfilMm: padrao.perfilMm,
          espessuraMm: padrao.espessuraMm,
          repeticoes: padrao.repeticoes,
          comprimentoBarraMm: padrao.comprimentoBarraMm,
          comprimentoPecasPorBarraMm: padrao.comprimentoPecasPorBarraMm,
          perdaCortesPorBarraMm: padrao.perdaCortesPorBarraMm,
          refileInicialMm: padrao.refileInicialMm,
          sobraPorBarraMm: padrao.sobraPorBarraMm,
          aproveitamentoPct: padrao.aproveitamentoPct,
        },
        select: { id: true, ordem: true },
      })),
    );

    const padraoIdPorOrdem = new Map(padroesCriados.map((padrao) => [padrao.ordem, padrao.id]));
    await prisma.$transaction(
      calculo.padroes.flatMap((padrao) => padrao.itens.map((item, indice) => prisma.planoCorteTuboItem.create({
        data: {
          padraoId: padraoIdPorOrdem.get(padrao.ordem)!,
          opId: item.opId,
          pecaId: item.pecaId,
          ordem: indice + 1,
          opNumero: item.opNumero,
          lote: item.lote,
          modeloCodigo: item.modeloCodigo,
          pecaCodigo: item.pecaCodigo,
          pecaNome: item.pecaNome,
          quantidadePorBarra: item.quantidadePorBarra,
          quantidadeTotal: item.quantidadeTotal,
          comprimentoUnitarioMm: item.comprimentoMm,
        },
      }))),
    );

    await registrarAlteracao({
      entidade: "PLANO_CORTE_TUBO",
      entidadeId: plano.id,
      acao: "CRIADO",
      usuario: usuario.nome,
      descricao: `Plano orientativo ${plano.codigo} emitido com ${calculo.indicadores.totalBarras} barras e ${calculo.indicadores.totalPecas} peças.`,
      dadosDepois: { opsIds, parametros, indicadores: calculo.indicadores, snapshotHash },
    });
    revalidatePath("/pcp/plano-corte-tubos");
    revalidatePath(`/pcp/plano-corte-tubos/${plano.id}`);
    return { ok: true, id: plano.id, mensagem: "Plano emitido. Nenhuma OP ou quantidade foi alterada." };
  } catch (erro) {
    if (planoCriadoId) {
      try {
        await prisma.planoCorteTubo.delete({ where: { id: planoCriadoId } });
      } catch (limpezaErro) {
        console.error("Não foi possível remover plano incompleto", limpezaErro);
      }
    }
    return { ok: false, mensagem: erro instanceof Error ? erro.message : "Não foi possível emitir o plano." };
  }
}
