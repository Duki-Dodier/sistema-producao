"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

async function saveFileLocally(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const hash = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(file.name) || ".png";
  const fileName = `${hash}${ext}`;
  
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(uploadDir, fileName);

  await fs.writeFile(filePath, buffer);

  return `/uploads/${fileName}`;
}

export async function uploadImagemModelo(modeloId: number, formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return { error: "Nenhum arquivo enviado" };

    const fileUrl = await saveFileLocally(file);

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

    const fileUrl = await saveFileLocally(file);

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
