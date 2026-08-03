"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { salvarImagem } from "@/lib/upload";
import { exigirAdministrador } from "@/lib/auth-operador";

export async function uploadImagemModelo(modeloId: number, formData: FormData) {
  await exigirAdministrador();
  try {
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "Nenhum arquivo enviado" };

    const modelo = await prisma.modelo.findUnique({
      where: { id: modeloId },
      select: { codigo: true },
    });
    if (!modelo) return { error: "Modelo não encontrado" };

    const fileUrl = await salvarImagem(file, `${modelo.codigo}/modelo`, modelo.codigo);
    if (!fileUrl) return { error: "Nenhum arquivo enviado" };

    await prisma.modelo.update({
      where: { id: modeloId },
      data: { imagemUrl: fileUrl },
    });

    revalidatePath(`/registros/${modeloId}`);
    return { success: true };
  } catch (e: any) {
    console.error(e);
    return { error: "Erro ao salvar imagem do modelo" };
  }
}

export async function uploadImagemPeca(pecaId: number, modeloId: number, formData: FormData) {
  await exigirAdministrador();
  try {
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "Nenhum arquivo enviado" };

    const [modelo, peca] = await Promise.all([
      prisma.modelo.findUnique({ where: { id: modeloId }, select: { codigo: true } }),
      prisma.peca.findUnique({ where: { id: pecaId }, select: { codigo: true } }),
    ]);
    if (!modelo || !peca) return { error: "Modelo ou peça não encontrado" };

    const fileUrl = await salvarImagem(file, `${modelo.codigo}/pecas`, peca.codigo);
    if (!fileUrl) return { error: "Nenhum arquivo enviado" };

    await prisma.peca.update({
      where: { id: pecaId },
      data: { imagemUrl: fileUrl },
    });

    revalidatePath(`/registros/${modeloId}`);
    return { success: true };
  } catch (e: any) {
    console.error(e);
    return { error: "Erro ao salvar imagem da peça" };
  }
}
