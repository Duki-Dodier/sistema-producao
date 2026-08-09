"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/auth-operador";

export async function createSetor(formData: FormData) {
  await exigirAdministrador();
  const nome = String(formData.get("nome") ?? "").trim();
  const ordemPadrao = Number(formData.get("ordemPadrao") ?? 0);

  if (!nome) throw new Error("Nome do setor é obrigatório.");

  await prisma.setor.create({ data: { nome, ordemPadrao } });
  revalidatePath("/setores");
}

/** Configuração do setor: meta mensal, líder e dias úteis do mês. */
export async function updateSetorConfig(id: number, formData: FormData) {
  await exigirAdministrador();
  const metaRaw = String(formData.get("metaMensal") ?? "").trim();
  const mediaRaw = String(formData.get("mediaDiariaMeta") ?? "").trim();
  const lider = String(formData.get("lider") ?? "").trim();
  const diasRaw = String(formData.get("diasUteisMes") ?? "").trim();
  const mediaDiariaMeta = mediaRaw ? Number(mediaRaw) : null;

  if (mediaDiariaMeta !== null && (!Number.isFinite(mediaDiariaMeta) || mediaDiariaMeta < 0)) {
    throw new Error("A mÃ©dia diÃ¡ria deve ser um nÃºmero maior ou igual a zero.");
  }

  await prisma.setor.update({
    where: { id },
    data: {
      metaMensal: metaRaw ? Number(metaRaw) : null,
      mediaDiariaMeta,
      lider: lider || null,
      diasUteisMes: diasRaw ? Number(diasRaw) : null,
    },
  });

  revalidatePath("/monitoramento");
  revalidatePath("/setores");
  revalidatePath("/configuracoes");
}

export async function deleteSetor(id: number) {
  await exigirAdministrador();
  try {
    await prisma.setor.delete({ where: { id } });
  } catch {
    throw new Error(
      "Não é possível excluir: este setor está em uso em algum roteiro ou apontamento.",
    );
  }
  revalidatePath("/setores");
}
