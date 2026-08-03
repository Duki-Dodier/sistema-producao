"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { PROCESSOS } from "@/lib/processos";
import { criarSenhaHash, exigirUsuarioLogado, normalizarUsuario } from "@/lib/auth-operador";

export async function createFuncionario(formData: FormData) {
  const acesso = await exigirUsuarioLogado();
  if (!acesso.administrador) throw new Error("Apenas o administrador pode cadastrar funcionarios.");
  const nome = String(formData.get("nome") ?? "").trim();
  const setorId = Number(formData.get("setorId"));
  const usuario = normalizarUsuario(nome.split(/\s+/)[0] ?? "");

  if (!nome || !setorId) {
    throw new Error("Preencha nome e setor do funcionário.");
  }

  try {
    await prisma.funcionario.create({
      data: {
        nome,
        setorId,
        usuario,
        pin: "1234",
        senhaHash: await criarSenhaHash("1234"),
      },
    });
  } catch {
    throw new Error("Já existe um funcionário com esse nome neste setor.");
  }

  revalidatePath("/configuracoes");
  revalidatePath("/agrupamento");
  revalidatePath("/monitoramento");
}

const PAPEIS = ["OPERADOR", "LIDER", "PCP"] as const;

/** Define o papel (Operador/Líder/PCP) e o PIN de 4 dígitos do funcionário. */
export async function updateFuncionarioAcesso(id: number, formData: FormData) {
  const acesso = await exigirUsuarioLogado();
  if (!acesso.administrador) throw new Error("Apenas o administrador pode alterar acessos.");
  const papel = String(formData.get("papel") ?? "OPERADOR");
  const pinRaw = String(formData.get("pin") ?? "").trim();
  const processos = PROCESSOS.filter((processo) =>
    formData.getAll("processos").map(String).includes(processo),
  );

  if (!PAPEIS.includes(papel as (typeof PAPEIS)[number])) {
    throw new Error("Papel inválido.");
  }
  if (pinRaw && !/^\d{4}$/.test(pinRaw)) {
    throw new Error("O PIN deve ter exatamente 4 dígitos.");
  }
  if (papel === "OPERADOR" && processos.length === 0) {
    throw new Error("Selecione ao menos um processo permitido para o operador.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.funcionario.update({
      where: { id },
      data: { papel, pin: pinRaw || null },
    });
    await tx.funcionarioProcesso.deleteMany({ where: { funcionarioId: id } });
    if (processos.length > 0) {
      await tx.funcionarioProcesso.createMany({
        data: processos.map((processo) => ({ funcionarioId: id, processo })),
      });
    }
  });

  revalidatePath("/configuracoes");
  revalidatePath("/apontamentos");
}

export async function toggleFuncionario(id: number) {
  const acesso = await exigirUsuarioLogado();
  if (!acesso.administrador) throw new Error("Apenas o administrador pode alterar funcionarios.");
  const f = await prisma.funcionario.findUnique({ where: { id } });
  if (!f) throw new Error("Funcionário não encontrado.");

  await prisma.funcionario.update({
    where: { id },
    data: { ativo: !f.ativo },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/agrupamento");
}

export async function deleteFuncionario(id: number) {
  const acesso = await exigirUsuarioLogado();
  if (!acesso.administrador) throw new Error("Apenas o administrador pode excluir funcionarios.");
  await prisma.funcionario.delete({ where: { id } });
  revalidatePath("/configuracoes");
  revalidatePath("/agrupamento");
}
