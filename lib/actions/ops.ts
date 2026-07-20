"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const STATUS_OP = new Set(["ABERTA", "CONCLUIDA", "CANCELADA"]);

function validarDadosOP(numeroSequencia: number, modeloId: number, quantidade: number, lote: string) {
  if (!Number.isInteger(numeroSequencia) || numeroSequencia < 0 || numeroSequencia > 1000) {
    throw new Error("O numero de sequencia deve ser um inteiro entre 0 e 1000.");
  }
  if (!Number.isInteger(modeloId) || !Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error("Preencha modelo e uma quantidade inteira positiva.");
  }
  if (!lote) {
    throw new Error("O preenchimento do lote é obrigatório.");
  }
}

function revalidarOPs() {
  revalidatePath("/ops");
  revalidatePath("/");
  revalidatePath("/monitoramento");
  revalidatePath("/apontamentos");
  revalidatePath("/agrupamento");
}

export async function createOP(formData: FormData) {
  const sequenciaInformada = String(formData.get("numeroSequencia") ?? "").trim();
  const modeloId = Number(formData.get("modeloId"));
  const quantidade = Number(formData.get("quantidade"));
  const dataInformada = String(formData.get("dataLiberacao") ?? "").trim();
  const previsaoInformada = String(formData.get("previsaoEntrega") ?? "").trim();
  const lote = String(formData.get("lote") ?? "").trim();

  let numeroSequencia: number;
  if (sequenciaInformada) {
    numeroSequencia = Number(sequenciaInformada);
  } else {
    const ultima = await prisma.oP.findFirst({
      orderBy: { numeroSequencia: "desc" },
      select: { numeroSequencia: true },
    });
    numeroSequencia = (ultima?.numeroSequencia ?? -1) + 1;
  }
  validarDadosOP(numeroSequencia, modeloId, quantidade, lote);

  try {
    await prisma.oP.create({
      data: {
        numeroSequencia,
        lote,
        modeloId,
        quantidade,
        dataLiberacao: dataInformada ? new Date(`${dataInformada}T12:00:00`) : undefined,
        previsaoEntrega: previsaoInformada ? new Date(`${previsaoInformada}T12:00:00`) : undefined,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new Error(`Já existe uma OP cadastrada com o lote "${lote}".`);
    }
    throw error;
  }
  revalidarOPs();
}

export async function updateStatusOP(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  if (!Number.isInteger(id) || !STATUS_OP.has(status)) throw new Error("Status da OP invalido.");
  await prisma.oP.update({ where: { id }, data: { status } });
  revalidarOPs();
}

export async function updateOP(id: number, formData: FormData) {
  const numeroSequencia = Number(formData.get("numeroSequencia"));
  const modeloId = Number(formData.get("modeloId"));
  const quantidade = Number(formData.get("quantidade"));
  const status = String(formData.get("status"));
  const dataInformada = String(formData.get("dataLiberacao") ?? "").trim();
  const previsaoInformada = String(formData.get("previsaoEntrega") ?? "").trim();
  const lote = String(formData.get("lote") ?? "").trim();

  if (!Number.isInteger(id)) throw new Error("OP invalida.");
  validarDadosOP(numeroSequencia, modeloId, quantidade, lote);
  if (!STATUS_OP.has(status)) throw new Error("Status da OP invalido.");

  try {
    await prisma.oP.update({
      where: { id },
      data: {
        numeroSequencia,
        lote,
        modeloId,
        quantidade,
        status,
        ...(dataInformada ? { dataLiberacao: new Date(`${dataInformada}T12:00:00`) } : {}),
        previsaoEntrega: previsaoInformada ? new Date(`${previsaoInformada}T12:00:00`) : null,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new Error(`Já existe uma OP cadastrada com o lote "${lote}".`);
    }
    throw error;
  }
  
  revalidarOPs();
  redirect("/ops");
}

export async function deleteOP(id: number) {
  if (!Number.isInteger(id)) throw new Error("OP invalida.");
  const apontamentos = await prisma.apontamento.count({ where: { opId: id } });
  if (apontamentos > 0) throw new Error("Nao e possivel excluir: esta OP ja tem apontamentos lancados.");
  await prisma.oP.delete({ where: { id } });
  revalidarOPs();
  redirect("/ops");
}
