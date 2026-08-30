"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuarioLogado, type OperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { registrarAlteracao } from "@/lib/auditoria";

export type LinhaFinalState = {
  error?: string;
  success?: string;
};

const LINHAS = ["BRUCKE", "REFORCEL"] as const;
type LinhaProduto = (typeof LINHAS)[number];

function quantidadeInteira(formData: FormData, campo: string, permitirZero = false) {
  const valor = Number(formData.get(campo) ?? 0);
  if (!Number.isInteger(valor) || valor < (permitirZero ? 0 : 1)) {
    throw new Error(
      permitirZero
        ? "As quantidades devem ser números inteiros e não podem ser negativas."
        : "Informe uma quantidade inteira maior que zero.",
    );
  }
  return valor;
}

function dataOperacional(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error("Informe uma data válida.");
  const data = new Date(`${valor}T12:00:00.000Z`);
  if (Number.isNaN(data.getTime())) throw new Error("Informe uma data válida.");
  return data;
}

function linhaValida(valor: string): LinhaProduto {
  const linha = valor.trim().toUpperCase();
  if (!LINHAS.includes(linha as LinhaProduto)) {
    throw new Error("A linha do produto deve ser BRUCKE ou REFORCEL.");
  }
  return linha as LinhaProduto;
}

function podeOperar(usuario: OperadorLogado, setor: "Pintura" | "Montagem") {
  return (
    usuario.administrador ||
    usuario.papel === "PCP" ||
    ehSetor(usuario.setorNome, setor)
  );
}

function exigirSetor(usuario: OperadorLogado, setor: "Pintura" | "Montagem") {
  if (!podeOperar(usuario, setor)) {
    throw new Error(`Seu usuário não tem permissão para registrar movimentações de ${setor}.`);
  }
}

function revalidarLinhaFinal() {
  revalidatePath("/monitoramento");
  revalidatePath("/apontamentos");
  revalidatePath("/ops");
  revalidatePath("/");
}

async function setoresLinhaFinal() {
  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  const solda = setores.find((setor) => ehSetor(setor.nome, "Solda"));
  const pintura = setores.find((setor) => ehSetor(setor.nome, "Pintura"));
  const montagem = setores.find((setor) => ehSetor(setor.nome, "Montagem"));
  if (!solda || !pintura || !montagem) {
    throw new Error("Os setores Solda, Pintura e Montagem precisam estar cadastrados nas Configurações.");
  }
  return { solda, pintura, montagem };
}

async function totalPintadoPorLinha(linha: LinhaProduto, ignorarData?: Date) {
  const fechamentos = await prisma.fechamentoPintura.findMany({
    where: ignorarData ? { data: { not: ignorarData } } : undefined,
    select: { quantidadeBrucke: true, quantidadeReforcel: true },
  });
  return fechamentos.reduce(
    (total, item) =>
      total + (linha === "BRUCKE" ? item.quantidadeBrucke : item.quantidadeReforcel),
    0,
  );
}

async function totalDistribuidoPorLinha(linha: LinhaProduto, pinturaId: number) {
  const apontamentos = await prisma.apontamento.findMany({
    where: { setorId: pinturaId, pecaId: null, op: { modelo: { linhaProduto: linha } } },
    select: { quantidadeBoa: true },
  });
  return apontamentos.reduce((total, item) => total + item.quantidadeBoa, 0);
}

export async function salvarFechamentoPintura(
  _estado: LinhaFinalState,
  formData: FormData,
): Promise<LinhaFinalState> {
  try {
    const usuario = await exigirUsuarioLogado();
    exigirSetor(usuario, "Pintura");
    const data = dataOperacional(String(formData.get("data") ?? ""));
    const quantidadeBrucke = quantidadeInteira(formData, "quantidadeBrucke", true);
    const quantidadeReforcel = quantidadeInteira(formData, "quantidadeReforcel", true);
    const refugoBrucke = quantidadeInteira(formData, "refugoBrucke", true);
    const refugoReforcel = quantidadeInteira(formData, "refugoReforcel", true);
    if (quantidadeBrucke + quantidadeReforcel + refugoBrucke + refugoReforcel === 0) {
      throw new Error("Informe ao menos uma quantidade produzida ou de refugo.");
    }

    const { pintura } = await setoresLinhaFinal();
    const [bruckeOutrosDias, reforcelOutrosDias, bruckeDistribuido, reforcelDistribuido] =
      await Promise.all([
        totalPintadoPorLinha("BRUCKE", data),
        totalPintadoPorLinha("REFORCEL", data),
        totalDistribuidoPorLinha("BRUCKE", pintura.id),
        totalDistribuidoPorLinha("REFORCEL", pintura.id),
      ]);
    if (bruckeOutrosDias + quantidadeBrucke < bruckeDistribuido) {
      throw new Error(
        `Não é possível reduzir BRUCKE: ${bruckeDistribuido} peça(s) já foram liberadas para Montagem.`,
      );
    }
    if (reforcelOutrosDias + quantidadeReforcel < reforcelDistribuido) {
      throw new Error(
        `Não é possível reduzir REFORCEL: ${reforcelDistribuido} peça(s) já foram liberadas para Montagem.`,
      );
    }

    await prisma.fechamentoPintura.upsert({
      where: { data },
      create: {
        data,
        quantidadeBrucke,
        quantidadeReforcel,
        refugoBrucke,
        refugoReforcel,
        usuario: usuario.nome,
      },
      update: {
        quantidadeBrucke,
        quantidadeReforcel,
        refugoBrucke,
        refugoReforcel,
        usuario: usuario.nome,
      },
    });
    revalidarLinhaFinal();
    return { success: "Fechamento da Pintura salvo." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o fechamento." };
  }
}

async function dadosDaOp(opId: number) {
  if (!Number.isInteger(opId)) throw new Error("OP inválida.");
  const { solda, pintura, montagem } = await setoresLinhaFinal();
  const op = await prisma.oP.findUnique({
    where: { id: opId },
    select: {
      id: true,
      quantidade: true,
      status: true,
      modelo: { select: { linhaProduto: true } },
      apontamentos: {
        where: { setorId: { in: [pintura.id, montagem.id] } },
        select: { setorId: true, quantidadeBoa: true },
      },
      entradasEstoque: { select: { quantidade: true } },
    },
  });
  if (!op) throw new Error("OP não encontrada.");
  if (op.status !== "ABERTA") throw new Error("Somente OPs abertas podem receber apontamentos.");
  const linha = linhaValida(op.modelo.linhaProduto);
  const pintado = op.apontamentos
    .filter((item) => item.setorId === pintura.id)
    .reduce((total, item) => total + item.quantidadeBoa, 0);
  const montado = op.apontamentos
    .filter((item) => item.setorId === montagem.id)
    .reduce((total, item) => total + item.quantidadeBoa, 0);
  const estoque = op.entradasEstoque.reduce((total, item) => total + item.quantidade, 0);
  return { op, linha, solda, pintura, montagem, pintado, montado, estoque };
}

export async function liberarParaMontagem(
  opId: number,
  _estado: LinhaFinalState,
  formData: FormData,
): Promise<LinhaFinalState> {
  try {
    const usuario = await exigirUsuarioLogado();
    exigirSetor(usuario, "Pintura");
    const quantidade = quantidadeInteira(formData, "quantidade");
    const dados = await dadosDaOp(opId);
    const soldado = await prisma.apontamento.aggregate({
      where: { opId, setorId: dados.solda.id, soldador: null, pecaId: null },
      _sum: { quantidadeBoa: true },
    });
    const totalSoldado = soldado._sum.quantidadeBoa ?? 0;
    const saldoSoldado = Math.min(totalSoldado, dados.op.quantidade) - dados.pintado;
    if (quantidade > saldoSoldado) {
      throw new Error(
        saldoSoldado > 0
          ? `A Solda liberou somente mais ${saldoSoldado} peça(s) desta OP.`
          : "Esta OP ainda não possui saldo soldado para liberar.",
      );
    }

    const [totalLinha, distribuidoLinha] = await Promise.all([
      totalPintadoPorLinha(dados.linha),
      totalDistribuidoPorLinha(dados.linha, dados.pintura.id),
    ]);
    const saldoLinha = totalLinha - distribuidoLinha;
    if (quantidade > saldoLinha) {
      throw new Error(
        `O fechamento da Pintura possui saldo de ${saldoLinha} peça(s) ${dados.linha}.`,
      );
    }

    await prisma.apontamento.create({
      data: {
        opId,
        setorId: dados.pintura.id,
        funcionarioId: usuario.id,
        usuario: usuario.nome,
        quantidadeBoa: quantidade,
        origem: "OPERADOR",
      },
    });
    revalidarLinhaFinal();
    return { success: `${quantidade} peça(s) liberada(s) para a Montagem.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível liberar a OP." };
  }
}

export async function registrarMontagem(
  opId: number,
  _estado: LinhaFinalState,
  formData: FormData,
): Promise<LinhaFinalState> {
  try {
    const usuario = await exigirUsuarioLogado();
    exigirSetor(usuario, "Montagem");
    const quantidade = quantidadeInteira(formData, "quantidade");
    const dados = await dadosDaOp(opId);
    const saldo = dados.pintado - dados.montado;
    if (quantidade > saldo) {
      throw new Error(
        saldo > 0
          ? `A Pintura liberou somente mais ${saldo} peça(s) desta OP.`
          : "Esta OP ainda não possui saldo liberado pela Pintura.",
      );
    }
    await prisma.apontamento.create({
      data: {
        opId,
        setorId: dados.montagem.id,
        funcionarioId: usuario.id,
        usuario: usuario.nome,
        quantidadeBoa: quantidade,
        origem: "OPERADOR",
      },
    });
    revalidarLinhaFinal();
    return { success: `${quantidade} peça(s) montada(s).` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível registrar a Montagem." };
  }
}

export async function enviarParaEstoque(
  opId: number,
  _estado: LinhaFinalState,
  formData: FormData,
): Promise<LinhaFinalState> {
  try {
    const usuario = await exigirUsuarioLogado();
    exigirSetor(usuario, "Montagem");
    const quantidade = quantidadeInteira(formData, "quantidade");
    const dados = await dadosDaOp(opId);
    const saldo = dados.montado - dados.estoque;
    if (quantidade > saldo) {
      throw new Error(
        saldo > 0
          ? `Há somente ${saldo} peça(s) montada(s) disponíveis para o Estoque.`
          : "Esta OP ainda não possui saldo montado para enviar ao Estoque.",
      );
    }
    const novoTotal = dados.estoque + quantidade;
    await prisma.$transaction([
      prisma.entradaEstoque.create({
        data: { opId, quantidade, usuario: usuario.nome },
      }),
      ...(novoTotal >= dados.op.quantidade
        ? [
            prisma.oP.update({
              where: { id: opId },
              data: { status: "CONCLUIDA", dataFinalizacao: new Date() },
            }),
          ]
        : []),
    ]);
    await registrarAlteracao({ entidade: "ESTOQUE", entidadeId: opId, acao: "MOVIMENTADO", descricao: `${quantidade} peça(s) da OP ${opId} enviada(s) ao estoque.`, usuario: usuario.nome, dadosDepois: { quantidade, novoTotal } });
    revalidarLinhaFinal();
    return {
      success:
        novoTotal >= dados.op.quantidade
          ? `${quantidade} peça(s) enviada(s). OP concluída e liberada no Estoque.`
          : `${quantidade} peça(s) enviada(s) parcialmente ao Estoque.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível enviar ao Estoque." };
  }
}
