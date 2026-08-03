"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { exigirUsuarioLogado } from "@/lib/auth-operador";

function revalidarTudo() {
  revalidatePath("/");
  revalidatePath("/apontamentos");
  revalidatePath("/agrupamento");
  revalidatePath("/solda");
  revalidatePath("/monitoramento");
}

/**
 * Corrige a quantidade de um apontamento lançado errado.
 * Regras acordadas com o PCP:
 *  - Líder autoriza SOMENTE ajustes do próprio setor; PCP autoriza qualquer um.
 *  - O autorizador se identifica com PIN de 4 dígitos (obrigatório).
 *  - O valor do apontamento é atualizado, mas cada mudança fica gravada em
 *    `AjusteApontamento` (valor anterior, valor novo, motivo, quem, quando).
 */
export async function ajustarApontamento(formData: FormData) {
  await exigirUsuarioLogado();
  const apontamentoId = Number(formData.get("apontamentoId"));
  const quantidadeCorreta = Number(formData.get("quantidadeCorreta"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  const autorizadorId = Number(formData.get("autorizadorId"));
  const pin = String(formData.get("pin") ?? "").trim();

  if (!Number.isInteger(apontamentoId) || !Number.isInteger(autorizadorId)) {
    throw new Error("Apontamento ou autorizador inválido.");
  }
  if (!Number.isInteger(quantidadeCorreta) || quantidadeCorreta < 0) {
    throw new Error("Informe a quantidade correta (inteiro ≥ 0).");
  }
  if (!motivo) {
    throw new Error("Informe o motivo do ajuste.");
  }
  if (motivo.length > 200) {
    throw new Error("Motivo muito longo (máx. 200 caracteres).");
  }

  await prisma.$transaction(async (tx) => {
    const [apontamento, autorizador] = await Promise.all([
      tx.apontamento.findUnique({
        where: { id: apontamentoId },
        select: { id: true, setorId: true, quantidadeBoa: true },
      }),
      tx.funcionario.findUnique({
        where: { id: autorizadorId },
        select: { id: true, nome: true, papel: true, pin: true, ativo: true, setorId: true },
      }),
    ]);

    if (!apontamento) throw new Error("Apontamento não encontrado.");
    if (!autorizador || !autorizador.ativo) {
      throw new Error("Autorizador não encontrado ou inativo.");
    }
    if (autorizador.papel !== "LIDER" && autorizador.papel !== "PCP") {
      throw new Error("Apenas Líder do setor ou PCP podem autorizar ajustes.");
    }
    if (!autorizador.pin) {
      throw new Error(
        `${autorizador.nome} ainda não tem PIN cadastrado — defina em Configurações antes de autorizar.`,
      );
    }
    if (autorizador.pin !== pin) {
      throw new Error("PIN incorreto.");
    }
    if (autorizador.papel === "LIDER" && autorizador.setorId !== apontamento.setorId) {
      throw new Error("Líder só pode ajustar apontamentos do próprio setor.");
    }
    if (quantidadeCorreta === apontamento.quantidadeBoa) {
      throw new Error("A quantidade informada é igual à atual — nada a ajustar.");
    }

    await tx.ajusteApontamento.create({
      data: {
        apontamentoId: apontamento.id,
        valorAnterior: apontamento.quantidadeBoa,
        valorNovo: quantidadeCorreta,
        motivo,
        autorizadoPorId: autorizador.id,
      },
    });
    await tx.apontamento.update({
      where: { id: apontamento.id },
      data: { quantidadeBoa: quantidadeCorreta },
    });
  });

  revalidarTudo();
}
