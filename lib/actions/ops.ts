"use server";

import { prisma } from "@/lib/prisma";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdministrador, exigirUsuarioLogado } from "@/lib/auth-operador";

const STATUS_OP = new Set(["ABERTA", "CONCLUIDA", "CANCELADA"]);

export type OPActionState = {
  error?: string;
  success?: string;
};

function ehErroDeLoteDuplicado(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

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
  await exigirAdministrador();
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
  } catch (error: unknown) {
    if (ehErroDeLoteDuplicado(error)) {
      throw new Error(`Já existe uma OP cadastrada com o lote "${lote}".`);
    }
    throw error;
  }
  revalidarOPs();
}

export async function updateStatusOP(
  _previousState: OPActionState,
  formData: FormData,
): Promise<OPActionState> {
  const usuario = await exigirUsuarioLogado();
  if (!usuario.administrador) {
    return { error: "Somente o administrador pode alterar o status da OP." };
  }
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  if (!Number.isInteger(id) || !STATUS_OP.has(status)) {
    return { error: "Status da OP inválido." };
  }

  try {
    const opAtual = await prisma.oP.findUnique({
      where: { id },
      select: { dataFinalizacao: true },
    });
    if (!opAtual) return { error: "OP não encontrada." };
    await prisma.oP.update({
      where: { id },
      data: {
        status,
        dataFinalizacao:
          status === "CONCLUIDA" ? opAtual.dataFinalizacao ?? new Date() : null,
      },
    });
  } catch (error) {
    console.error("Falha ao atualizar status da OP", error);
    return { error: "Não foi possível atualizar o status da OP." };
  }

  revalidarOPs();
  refresh();
  return { success: "Status atualizado." };
}

export async function updateOP(id: number, formData: FormData) {
  await exigirAdministrador();
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
    const opAtual = await prisma.oP.findUnique({
      where: { id },
      select: { dataFinalizacao: true },
    });
    if (!opAtual) throw new Error("OP nao encontrada.");
    await prisma.oP.update({
      where: { id },
      data: {
        numeroSequencia,
        lote,
        modeloId,
        quantidade,
        status,
        dataFinalizacao:
          status === "CONCLUIDA" ? opAtual.dataFinalizacao ?? new Date() : null,
        ...(dataInformada ? { dataLiberacao: new Date(`${dataInformada}T12:00:00`) } : {}),
        previsaoEntrega: previsaoInformada ? new Date(`${previsaoInformada}T12:00:00`) : null,
      },
    });
  } catch (error: unknown) {
    if (ehErroDeLoteDuplicado(error)) {
      throw new Error(`Já existe uma OP cadastrada com o lote "${lote}".`);
    }
    throw error;
  }
  
  revalidarOPs();
  redirect("/ops");
}

export async function deleteOP(
  id: number,
  _previousState: OPActionState,
  _formData: FormData,
): Promise<OPActionState> {
  void _previousState;
  void _formData;
  const usuario = await exigirUsuarioLogado();
  if (!usuario.administrador) {
    return { error: "Somente o administrador pode excluir uma OP." };
  }
  if (!Number.isInteger(id)) return { error: "OP inválida." };

  const apontamentos = await prisma.apontamento.count({ where: { opId: id } });
  if (apontamentos > 0) {
    return {
      error: "Esta OP já possui apontamentos e não pode ser excluída. Use Cancelada ou Finalizada.",
    };
  }

  try {
    await prisma.oP.delete({ where: { id } });
  } catch (error) {
    console.error("Falha ao excluir OP", error);
    return { error: "Não foi possível excluir esta OP. Atualize a página e tente novamente." };
  }

  revalidarOPs();
  redirect("/ops");
}
