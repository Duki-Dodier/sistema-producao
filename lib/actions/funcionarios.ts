"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { PROCESSOS } from "@/lib/processos";
import { criarSenhaHash, exigirUsuarioLogado, normalizarUsuario } from "@/lib/auth-operador";
import { registrarAlteracao } from "@/lib/auditoria";

export async function createFuncionario(formData: FormData) {
  const acesso = await exigirUsuarioLogado();
  if (!acesso.administrador) throw new Error("Apenas o administrador pode cadastrar funcionarios.");
  const nome = String(formData.get("nome") ?? "").trim();
  const setorId = Number(formData.get("setorId"));
  const usuario = normalizarUsuario(nome.split(/\s+/)[0] ?? "");

  if (!nome || !setorId) {
    throw new Error("Preencha nome e setor do funcionário.");
  }

  const setor = await prisma.setor.findUnique({
    where: { id: setorId },
    select: { nome: true },
  });
  const ehSolda = setor?.nome.trim().toLocaleUpperCase("pt-BR") === "SOLDA";
  const bancadasCadastradas = ehSolda
    ? await prisma.funcionario.count({ where: { setorId, bancada: { not: null } } })
    : 0;
  const bancada = ehSolda
    ? `BOX ${String(bancadasCadastradas + 1).padStart(2, "0")}`
    : null;

  try {
    const funcionario = await prisma.funcionario.create({
      data: {
        nome,
        setorId,
        usuario,
        pin: "1234",
        senhaHash: await criarSenhaHash("1234"),
        bancada,
      },
    });
    await registrarAlteracao({ entidade: "FUNCIONARIO", entidadeId: funcionario.id, acao: "CRIADO", descricao: `Funcionário ${nome} cadastrado.`, usuario: acesso.nome, dadosDepois: { nome, setorId, bancada } });
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
  const setorId = Number(formData.get("setorId"));
  const pinRaw = String(formData.get("pin") ?? "").trim();
  const bancadaRaw = String(formData.get("bancada") ?? "").trim();
  const processos = PROCESSOS.filter((processo) =>
    formData.getAll("processos").map(String).includes(processo),
  );

  if (!PAPEIS.includes(papel as (typeof PAPEIS)[number]) || !Number.isInteger(setorId) || setorId <= 0) {
    throw new Error("Papel ou setor inválido.");
  }
  if (pinRaw && !/^\d{4}$/.test(pinRaw)) {
    throw new Error("O PIN deve ter exatamente 4 dígitos.");
  }
  if (papel === "OPERADOR" && processos.length === 0) {
    throw new Error("Selecione ao menos um processo permitido para o operador.");
  }

  await prisma.funcionario.update({
      where: { id },
      data: { papel, setorId, pin: pinRaw || null, bancada: bancadaRaw || null },
    });
  await prisma.funcionarioProcesso.deleteMany({ where: { funcionarioId: id } });
  if (processos.length > 0) {
    await prisma.funcionarioProcesso.createMany({
      data: processos.map((processo) => ({ funcionarioId: id, processo })),
    });
  }
  await registrarAlteracao({ entidade: "FUNCIONARIO", entidadeId: id, acao: "ATUALIZADO", descricao: `Acesso do funcionário ${id} atualizado.`, usuario: acesso.nome, dadosDepois: { papel, setorId, bancada: bancadaRaw || null, processos } });

  revalidatePath("/configuracoes");
  revalidatePath("/apontamentos");
  revalidatePath("/setores");
  revalidatePath("/monitoramento");
  revalidatePath("/agrupamento");
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
  await registrarAlteracao({ entidade: "FUNCIONARIO", entidadeId: id, acao: "ATUALIZADO", descricao: `Funcionário ${id} ${f.ativo ? "desativado" : "ativado"}.`, usuario: acesso.nome, dadosDepois: { ativo: !f.ativo } });

  revalidatePath("/configuracoes");
  revalidatePath("/agrupamento");
}

export async function deleteFuncionario(id: number) {
  const acesso = await exigirUsuarioLogado();
  if (!acesso.administrador) throw new Error("Apenas o administrador pode excluir funcionarios.");
  const anterior = await prisma.funcionario.findUnique({ where: { id }, select: { nome: true } });
  await prisma.funcionario.delete({ where: { id } });
  await registrarAlteracao({ entidade: "FUNCIONARIO", entidadeId: id, acao: "EXCLUIDO", descricao: `Funcionário ${anterior?.nome ?? id} excluído.`, usuario: acesso.nome });
  revalidatePath("/configuracoes");
  revalidatePath("/agrupamento");
}
