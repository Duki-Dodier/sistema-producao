"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ehSetor } from "@/lib/setores";

function revalidarSolda() {
  revalidatePath("/solda");
  revalidatePath("/abastecimento");
  revalidatePath("/");
  revalidatePath("/monitoramento");
}

export async function createApontamentoSolda(formData: FormData) {
  const opId = Number(formData.get("opId"));
  const soldador = String(formData.get("soldador") ?? "").trim();
  const bancada = String(formData.get("bancada") ?? "").trim();
  const abastecedor = String(formData.get("abastecedor") ?? "").trim();
  const quantidadeBoa = Number(formData.get("quantidadeBoa") ?? 0);
  const dataInformada = String(formData.get("data") ?? "").trim();

  if (!Number.isInteger(opId) || !soldador || !bancada) throw new Error("Preencha OP, soldador e bancada.");
  if (!Number.isInteger(quantidadeBoa) || quantidadeBoa <= 0) throw new Error("Informe uma quantidade inteira positiva.");

  await prisma.$transaction(async (tx) => {
    const setores = await tx.setor.findMany();
    const setorSolda = setores.find((setor) => ehSetor(setor.nome, "Solda"));
    if (!setorSolda) throw new Error('Setor "Solda" nao esta cadastrado.');

    const [op, jaEnviado] = await Promise.all([
      tx.oP.findUnique({
        where: { id: opId },
        select: { quantidade: true, status: true, modelo: { select: { roteiro: { select: { setorId: true } } } } },
      }),
      tx.apontamento.aggregate({
        where: { opId, setorId: setorSolda.id, soldador: { not: null } },
        _sum: { quantidadeBoa: true },
      }),
    ]);
    if (!op) throw new Error("OP nao encontrada.");
    if (op.status !== "ABERTA") throw new Error("So e possivel enviar uma OP aberta para Solda.");
    if (!op.modelo.roteiro.some((etapa) => etapa.setorId === setorSolda.id)) {
      throw new Error("A OP nao possui Solda no roteiro.");
    }
    const saldo = op.quantidade - (jaEnviado._sum.quantidadeBoa ?? 0);
    if (quantidadeBoa > saldo) throw new Error(`Quantidade maior que o saldo da OP: restam ${saldo} peca(s).`);

    await tx.apontamento.create({
      data: {
        opId,
        setorId: setorSolda.id,
        usuario: soldador,
        soldador,
        bancada,
        abastecedor: abastecedor || null,
        quantidadeBoa,
        ...(dataInformada ? { dataHora: new Date(`${dataInformada}T12:00:00`) } : {}),
      },
    });
  });
  revalidarSolda();
}

export async function updateQuantidadeSoldada(envioId: number, formData: FormData) {
  const quantidadeSoldada = Number(formData.get("quantidadeSoldada") ?? 0);
  if (!Number.isInteger(envioId) || !Number.isInteger(quantidadeSoldada) || quantidadeSoldada < 0) {
    throw new Error("Quantidade soldada invalida.");
  }
  const envio = await prisma.apontamento.findUnique({ where: { id: envioId }, select: { quantidadeBoa: true } });
  if (!envio) throw new Error("Envio nao encontrado.");
  if (quantidadeSoldada > envio.quantidadeBoa) throw new Error("Quantidade soldada maior que a abastecida neste envio.");
  await prisma.apontamento.update({ where: { id: envioId }, data: { quantidadeSoldada } });
  revalidarSolda();
}
