"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createFuncionario(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const setorId = Number(formData.get("setorId"));

  if (!nome || !setorId) {
    throw new Error("Preencha nome e setor do funcionário.");
  }

  try {
    await prisma.funcionario.create({ data: { nome, setorId } });
  } catch {
    throw new Error("Já existe um funcionário com esse nome neste setor.");
  }

  revalidatePath("/configuracoes");
  revalidatePath("/abastecimento");
  revalidatePath("/monitoramento");
}

const PAPEIS = ["OPERADOR", "LIDER", "PCP"] as const;

/** Define o papel (Operador/Líder/PCP) e o PIN de 4 dígitos do funcionário. */
export async function updateFuncionarioAcesso(id: number, formData: FormData) {
  const papel = String(formData.get("papel") ?? "OPERADOR");
  const pinRaw = String(formData.get("pin") ?? "").trim();

  if (!PAPEIS.includes(papel as (typeof PAPEIS)[number])) {
    throw new Error("Papel inválido.");
  }
  if (pinRaw && !/^\d{4}$/.test(pinRaw)) {
    throw new Error("O PIN deve ter exatamente 4 dígitos.");
  }

  await prisma.funcionario.update({
    where: { id },
    data: { papel, pin: pinRaw || null },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/apontamentos");
}

export async function toggleFuncionario(id: number) {
  const f = await prisma.funcionario.findUnique({ where: { id } });
  if (!f) throw new Error("Funcionário não encontrado.");

  await prisma.funcionario.update({
    where: { id },
    data: { ativo: !f.ativo },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/abastecimento");
}

export async function deleteFuncionario(id: number) {
  await prisma.funcionario.delete({ where: { id } });
  revalidatePath("/configuracoes");
  revalidatePath("/abastecimento");
}
