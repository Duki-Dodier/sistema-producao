"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function salvarRecebimentoAgrupamento(formData: FormData) {
  const opId = Number(formData.get("opId"));
  const setorOrigemId = Number(formData.get("setorOrigemId"));
  const categoria = String(formData.get("categoria") ?? "").trim();
  const pecaIds = formData.getAll("pecaId").map(Number).filter(Number.isInteger);
  const recebidoPor = String(formData.get("recebidoPor") ?? "").trim();
  const localizacao = String(formData.get("localizacao") ?? "").trim();

  if (!Number.isInteger(opId) || !Number.isInteger(setorOrigemId)) {
    throw new Error("OP ou setor inválido.");
  }
  if (!/^(SETOR:\d+|PONTEIRA|REFORCO)$/.test(categoria)) {
    throw new Error("Categoria de recebimento inválida.");
  }
  if (!recebidoPor) {
    throw new Error("Informe o nome de quem recebeu as peças.");
  }
  if (!localizacao) {
    throw new Error("Informe onde as peças foram colocadas.");
  }
  if (recebidoPor.length > 120 || localizacao.length > 160) {
    throw new Error("Nome ou localização muito longo.");
  }

  await prisma.$transaction(async (tx) => {
    const op = await tx.oP.findUnique({
      where: { id: opId },
      select: {
        status: true,
        modelo: {
          select: {
            roteiro: { select: { setorId: true } },
            pecas: { select: { pecaId: true } },
          },
        },
      },
    });

    if (!op) throw new Error("OP não encontrada.");
    if (op.status !== "ABERTA") {
      throw new Error("Só é possível receber peças de uma OP aberta.");
    }
    if (!op.modelo.roteiro.some((etapa) => etapa.setorId === setorOrigemId)) {
      throw new Error("O setor informado não faz parte do roteiro desta OP.");
    }
    if (pecaIds.length === 0 || pecaIds.some((pecaId) => !op.modelo.pecas.some((item) => item.pecaId === pecaId))) {
      throw new Error("As peças informadas não pertencem a esta OP.");
    }

    const producao = await tx.apontamento.aggregate({
      where: { opId, pecaId: { in: pecaIds } },
      _sum: { quantidadeBoa: true },
    });
    if ((producao._sum.quantidadeBoa ?? 0) <= 0) {
      throw new Error("Ainda não há peças produzidas por este setor para receber.");
    }

    await tx.recebimentoAgrupamento.upsert({
      where: { opId_categoria: { opId, categoria } },
      create: { opId, setorOrigemId, categoria, recebidoPor, localizacao },
      update: { setorOrigemId, recebidoPor, localizacao, dataHora: new Date() },
    });
  });

  revalidatePath("/agrupamento");
}
