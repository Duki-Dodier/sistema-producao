"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuarioLogado, type OperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { registrarAlteracao } from "@/lib/auditoria";
import { calcularPlanoCorteTubo, type ParametrosPlanoCorteTubo } from "@/lib/tubo-plano-corte";
import { buscarDemandaPlanoTubo, buscarSetorTubo, gerarSnapshotPlanoTubo } from "@/lib/tubo-plano-corte-dados";

export type ResultadoAcaoPlanoTubo = { ok: true; id?: number; mensagem: string } | { ok: false; mensagem: string };

function numero(formData: FormData, campo: string, minimo = 0) {
  const valor = Number(String(formData.get(campo) ?? "").replace(",", "."));
  if (!Number.isFinite(valor) || valor < minimo) throw new Error(`${campo} deve ser no mínimo ${minimo}.`);
  return valor;
}

function podePlanejar(usuario: OperadorLogado) {
  return usuario.administrador || usuario.papel === "PCP" || (usuario.papel === "LIDER" && ehSetor(usuario.setorNome, "Tubo"));
}

function podeConcluir(usuario: OperadorLogado) {
  return podePlanejar(usuario) || (usuario.papel === "OPERADOR" && ehSetor(usuario.setorNome, "Tubo"));
}

async function contextoTubo(usuario: OperadorLogado) {
  const setor = await buscarSetorTubo();
  if (!setor) throw new Error("Setor TUBO não encontrado.");
  if (!usuario.administrador && usuario.papel !== "PCP" && usuario.setorId !== setor.id) {
    throw new Error("Este usuário não pertence ao setor TUBO.");
  }
  return setor;
}

function parametrosDoFormulario(formData: FormData): ParametrosPlanoCorteTubo {
  return {
    comprimentoBarraMm: 6000,
    perdaCorteMm: numero(formData, "perdaCorteMm"),
    margemInicialMm: numero(formData, "margemInicialMm"),
    margemFinalMm: numero(formData, "margemFinalMm"),
    minimoSobraMm: numero(formData, "minimoSobraMm", 1),
  };
}

function revalidarPlanoTubo(id?: number) {
  revalidatePath("/tubo/plano-corte");
  revalidatePath("/apontamentos");
  revalidatePath("/monitoramento");
  revalidatePath("/");
  if (id) revalidatePath(`/tubo/plano-corte/${id}`);
}

export async function emitirPlanoCorteTuboSeguro(
  _anterior: ResultadoAcaoPlanoTubo | null,
  formData: FormData,
): Promise<ResultadoAcaoPlanoTubo> {
  try {
    const usuario = await exigirUsuarioLogado();
    if (!podePlanejar(usuario)) throw new Error("Somente Administrador, PCP ou Líder do TUBO pode emitir planos.");
    const setor = await contextoTubo(usuario);
    const parametros = parametrosDoFormulario(formData);
    const maquinaIdRaw = Number(formData.get("maquinaId"));
    const maquinaId = Number.isInteger(maquinaIdRaw) && maquinaIdRaw > 0 ? maquinaIdRaw : null;
    if (maquinaId) {
      const maquina = await prisma.maquina.findFirst({ where: { id: maquinaId, setorId: setor.id, ativo: true }, select: { id: true } });
      if (!maquina) throw new Error("Máquina do TUBO inválida.");
    }
    const dados = await buscarDemandaPlanoTubo(setor.id);
    if (dados.incompletas.length) throw new Error("Há peças com medidas incompletas. Corrija o cadastro antes de emitir.");
    if (!dados.demandas.length) throw new Error("Não há demanda pendente de corte no TUBO.");
    const calculo = calcularPlanoCorteTubo(dados.demandas, dados.sobras, parametros);
    if (calculo.erros.length) throw new Error(calculo.erros[0]);
    const snapshotHash = await gerarSnapshotPlanoTubo(dados.demandas, dados.sobras, parametros);
    const existente = await prisma.planoCorteTubo.findUnique({ where: { snapshotHash }, select: { id: true } });
    if (existente) return { ok: true, id: existente.id, mensagem: "Este mesmo plano já havia sido emitido." };

    const agora = new Date();
    const codigo = `PCT-${agora.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const plano = await prisma.planoCorteTubo.create({
      data: {
        codigo, setorId: setor.id, maquinaId, criadoPorId: usuario.id, snapshotHash,
        ...parametros,
        totalBarrasNovas: calculo.indicadores.barrasNovas,
        totalSobrasUsadas: calculo.indicadores.sobrasReaproveitadas,
        totalPecas: calculo.indicadores.pecasProgramadas,
        comprimentoPecasMm: calculo.indicadores.metrosUtilizados * 1000,
        perdaCortesTotalMm: calculo.indicadores.perdaCortesMm,
        sobraReutilizavelPrevistaMm: calculo.indicadores.sobraReutilizavelMm,
        desperdicioPrevistoMm: calculo.indicadores.desperdicioMm,
        aproveitamentoPct: calculo.indicadores.aproveitamentoPct,
      },
    });

    await prisma.$transaction([
      ...calculo.barras.map((barra) => prisma.planoCorteTuboBarra.create({
        data: {
          planoId: plano.id, ordem: barra.ordem, perfilA: barra.perfilA, perfilB: barra.perfilB,
          espessuraMm: barra.espessuraMm, origem: barra.origem,
          comprimentoOrigemMm: barra.comprimentoOrigemMm, sobraOrigemId: barra.sobraOrigemId,
          comprimentoConsumidoMm: barra.comprimentoConsumidoMm, sobraPrevistaMm: barra.sobraPrevistaMm,
          aproveitamentoPct: barra.aproveitamentoPct,
          itens: { create: barra.itens.map((item, indice) => ({
            opId: item.opId, pecaId: item.pecaId, ordem: indice + 1, quantidade: item.quantidade,
            comprimentoUnitarioMm: item.comprimentoMm, consumoTotalMm: item.consumoTotalMm,
          })) },
        },
      })),
      ...calculo.barras.filter((barra) => barra.sobraOrigemId !== null).map((barra) => prisma.sobraTubo.update({
        where: { id: barra.sobraOrigemId! },
        data: { status: "RESERVADA", planoReservaId: plano.id },
      })),
    ]);
    await registrarAlteracao({
      entidade: "PLANO_CORTE_TUBO", entidadeId: plano.id, acao: "CRIADO", usuario: usuario.nome,
      descricao: `Plano ${codigo} emitido com ${calculo.indicadores.pecasProgramadas} peças e ${calculo.indicadores.barrasNovas} barras novas.`,
      dadosDepois: { parametros, indicadores: calculo.indicadores },
    });
    revalidarPlanoTubo(plano.id);
    return { ok: true, id: plano.id, mensagem: "Plano emitido e demanda reservada com sucesso." };
  } catch (erro) {
    return { ok: false, mensagem: erro instanceof Error ? erro.message : "Não foi possível emitir o plano." };
  }
}

export async function cancelarPlanoCorteTuboSeguro(
  _anterior: ResultadoAcaoPlanoTubo | null,
  formData: FormData,
): Promise<ResultadoAcaoPlanoTubo> {
  try {
    const usuario = await exigirUsuarioLogado();
    if (!podePlanejar(usuario)) throw new Error("Você não pode cancelar este plano.");
    await contextoTubo(usuario);
    const id = numero(formData, "planoId", 1);
    const plano = await prisma.planoCorteTubo.findUnique({ where: { id }, select: { status: true, codigo: true } });
    if (!plano || plano.status !== "EMITIDO") throw new Error("Somente planos emitidos podem ser cancelados.");
    const sobras = await prisma.sobraTubo.findMany({ where: { planoReservaId: id, status: "RESERVADA" }, select: { id: true } });
    await prisma.$transaction([
      prisma.planoCorteTubo.update({ where: { id }, data: { status: "CANCELADO", canceladoPorId: usuario.id, canceladoEm: new Date() } }),
      ...sobras.map((sobra) => prisma.sobraTubo.update({ where: { id: sobra.id }, data: { status: "DISPONIVEL", planoReservaId: null } })),
    ]);
    await registrarAlteracao({ entidade: "PLANO_CORTE_TUBO", entidadeId: id, acao: "CANCELADO", usuario: usuario.nome, descricao: `Plano ${plano.codigo} cancelado e reservas liberadas.` });
    revalidarPlanoTubo(id);
    return { ok: true, id, mensagem: "Plano cancelado. As OPs e sobras foram liberadas." };
  } catch (erro) {
    return { ok: false, mensagem: erro instanceof Error ? erro.message : "Não foi possível cancelar o plano." };
  }
}

export async function concluirPlanoCorteTuboSeguro(
  _anterior: ResultadoAcaoPlanoTubo | null,
  formData: FormData,
): Promise<ResultadoAcaoPlanoTubo> {
  try {
    const usuario = await exigirUsuarioLogado();
    if (!podeConcluir(usuario)) throw new Error("Você não pode concluir este plano.");
    await contextoTubo(usuario);
    const id = numero(formData, "planoId", 1);
    const plano = await prisma.planoCorteTubo.findUnique({ where: { id }, include: { barras: { include: { itens: true } } } });
    if (!plano || plano.status !== "EMITIDO") throw new Error("Este plano já foi concluído ou cancelado.");
    const comandos = [];
    const agora = new Date();
    for (const barra of plano.barras) {
      const sobraReal = numero(formData, `sobraReal-${barra.id}`);
      if (sobraReal > barra.comprimentoOrigemMm) throw new Error(`A sobra da barra ${barra.ordem} é maior que a barra original.`);
      comandos.push(prisma.planoCorteTuboBarra.update({ where: { id: barra.id }, data: { sobraRealMm: sobraReal } }));
      if (barra.sobraOrigemId) {
        comandos.push(prisma.sobraTubo.update({ where: { id: barra.sobraOrigemId }, data: { status: "CONSUMIDA", planoReservaId: null, planoConsumoId: id } }));
      }
      if (sobraReal >= plano.minimoSobraMm) {
        comandos.push(prisma.sobraTubo.create({ data: {
          codigo: `ST-${plano.codigo}-${String(barra.ordem).padStart(3, "0")}`,
          perfilA: barra.perfilA, perfilB: barra.perfilB, espessuraMm: barra.espessuraMm,
          comprimentoMm: sobraReal, status: "DISPONIVEL", planoOrigemId: id,
        } }));
      }
    }
    const itensPorPeca = new Map<string, { opId: number; pecaId: number; quantidade: number }>();
    for (const item of plano.barras.flatMap((barra) => barra.itens)) {
      const chave = `${item.opId}-${item.pecaId}`;
      const atual = itensPorPeca.get(chave);
      itensPorPeca.set(chave, { opId: item.opId, pecaId: item.pecaId, quantidade: (atual?.quantidade ?? 0) + item.quantidade });
    }
    const pares = [...itensPorPeca.values()];
    const apontadosDepoisDaEmissao = pares.length ? await prisma.apontamento.findMany({
      where: {
        setorId: plano.setorId, processo: "CORTE", dataHora: { gte: plano.emitidoEm },
        OR: pares.map((item) => ({ opId: item.opId, pecaId: item.pecaId })),
      },
      select: { opId: true, pecaId: true, quantidadeBoa: true },
    }) : [];
    for (const item of pares) {
      const jaApontado = apontadosDepoisDaEmissao
        .filter((registro) => registro.opId === item.opId && registro.pecaId === item.pecaId)
        .reduce((total, registro) => total + registro.quantidadeBoa, 0);
      const quantidadeBoa = Math.max(item.quantidade - jaApontado, 0);
      if (quantidadeBoa > 0) comandos.push(prisma.apontamento.create({ data: {
        opId: item.opId, setorId: plano.setorId, funcionarioId: usuario.id, usuario: usuario.nome,
        quantidadeBoa, quantidadeRefugo: 0, pecaId: item.pecaId, processo: "CORTE",
        origem: "PLANO_CORTE_TUBO", maquinaId: plano.maquinaId, dataHora: agora,
      } }));
    }
    comandos.push(prisma.planoCorteTubo.update({ where: { id }, data: { status: "CONCLUIDO", concluidoPorId: usuario.id, concluidoEm: agora } }));
    await prisma.$transaction(comandos);
    await registrarAlteracao({ entidade: "PLANO_CORTE_TUBO", entidadeId: id, acao: "CONCLUIDO", usuario: usuario.nome, descricao: `Plano ${plano.codigo} concluído com confirmação das sobras reais.` });
    revalidarPlanoTubo(id);
    return { ok: true, id, mensagem: "Plano concluído. As sobras reaproveitáveis entraram no estoque." };
  } catch (erro) {
    return { ok: false, mensagem: erro instanceof Error ? erro.message : "Não foi possível concluir o plano." };
  }
}
