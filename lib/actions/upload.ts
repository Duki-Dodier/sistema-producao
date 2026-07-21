"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { salvarImagem } from "@/lib/upload";

export async function uploadImagemModelo(modeloId: number, formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "Nenhum arquivo enviado" };

    const fileUrl = await salvarImagem(file, "modelos");
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
  try {
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "Nenhum arquivo enviado" };

    const fileUrl = await salvarImagem(file, "pecas");
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
