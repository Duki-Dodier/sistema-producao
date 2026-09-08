"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { PROCESSOS } from "@/lib/processos";
import { criarSenhaHash, exigirUsuarioLogado, normalizarUsuario } from "@/lib/auth-operador";
import { registrarAlteracao } from "@/lib/auditoria";
import { ehSetor } from "@/lib/setores";

export async function createFuncionario(formData: FormData) {
  const acesso = await exigirUsuarioLogado();
  if (!acesso.administrador) throw new Error("Apenas o administrador pode cadastrar funcionarios.");
  const nome = String(formData.get("nome") ?? "").trim();
  const setorId = Number(formData.get("setorId"));
  const usuario = normalizarUsuario(String(formData.get("usuario") ?? ""));

  if (!nome || !setorId || !usuario) {
    throw new Error("Preencha nome, código/matrícula e setor do funcionário.");
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
    await prisma.contaAcesso.create({
      data: {
        funcionarioId: funcionario.id,
        usuario,
        senhaHash: await criarSenhaHash("1234"),
        senhaTemporaria: "1234",
        ativo: true,
      },
    });
    await registrarAlteracao({ entidade: "FUNCIONARIO", entidadeId: funcionario.id, acao: "CRIADO", descricao: `Funcionário ${nome} cadastrado.`, usuario: acesso.nome, dadosDepois: { nome, usuario, setorId, bancada } });
  } catch {
    throw new Error("Já existe um funcionário com esse código/matrícula.");
  }

  revalidatePath("/configuracoes");
  revalidatePath("/agrupamento");
  revalidatePath("/monitoramento");
}

const PAPEIS = ["OPERADOR", "LIDER", "PCP", "CONFERENTE"] as const;

/** Define o papel e o PIN de 4 dígitos do funcionário. */
export async function updateFuncionarioAcesso(id: number, formData: FormData) {
  const acesso = await exigirUsuarioLogado();
  if (!acesso.administrador) throw new Error("Apenas o administrador pode alterar acessos.");
  const papel = String(formData.get("papel") ?? "OPERADOR");
  const setorId = Number(formData.get("setorId"));
  const usuario = normalizarUsuario(String(formData.get("usuario") ?? ""));
  const senha = String(formData.get("senha") ?? "").trim();
  const pinRaw = String(formData.get("pin") ?? "").trim();
  const bancadaRaw = String(formData.get("bancada") ?? "").trim();
  const processosInformados = PROCESSOS.filter((processo) =>
    formData.getAll("processos").map(String).includes(processo),
  );
  const processos = papel === "CONFERENTE" ? [] : processosInformados;

  if (!usuario) {
    throw new Error("Informe um código/matrícula único para o funcionário.");
  }
  if (senha && (senha.length < 4 || senha.length > 64)) {
    throw new Error("A senha deve ter entre 4 e 64 caracteres.");
  }
  if (!PAPEIS.includes(papel as (typeof PAPEIS)[number]) || !Number.isInteger(setorId) || setorId <= 0) {
    throw new Error("Papel ou setor inválido.");
  }
  const usuarioExistente = await prisma.funcionario.findFirst({ where: { usuario, id: { not: id } }, select: { nome: true } });
  if (usuarioExistente) throw new Error(`O código/matrícula já está em uso por ${usuarioExistente.nome}.`);
  const contaExistente = await prisma.contaAcesso.findFirst({ where: { usuario, funcionarioId: { not: id } }, select: { funcionario: { select: { nome: true } } } });
  if (contaExistente) throw new Error(`O código/matrícula já está em uso por ${contaExistente.funcionario.nome}.`);
  if (pinRaw && !/^\d{4}$/.test(pinRaw)) {
    throw new Error("O PIN deve ter exatamente 4 dígitos.");
  }
  if (papel === "OPERADOR" && processos.length === 0) {
    throw new Error("Selecione ao menos um processo permitido para o operador.");
  }
  if (papel === "CONFERENTE") {
    const setor = await prisma.setor.findUnique({ where: { id: setorId }, select: { nome: true } });
    if (!setor || !ehSetor(setor.nome, "Plasma Chapa")) {
      throw new Error("O conferente exclusivo deve pertencer ao setor Plasma Chapa.");
    }
    const outro = await prisma.funcionario.findFirst({
      where: { id: { not: id }, ativo: true, papel: "CONFERENTE" }, select: { nome: true },
    });
    if (outro) throw new Error(`O conferente do Plasma já é ${outro.nome}. Altere essa pessoa primeiro.`);
  }

  const funcionarioAtual = await prisma.funcionario.findUnique({ where: { id }, select: { senhaHash: true } });
  const contaAtual = await prisma.contaAcesso.findUnique({ where: { funcionarioId: id }, select: { senhaHash: true, senhaTemporaria: true } });
  const senhaHash = senha
    ? await criarSenhaHash(senha)
    : contaAtual?.senhaHash ?? funcionarioAtual?.senhaHash;
  if (!senhaHash) throw new Error("Este funcionário ainda não possui uma senha cadastrada.");

  await prisma.funcionario.update({
      where: { id },
      data: { usuario, senhaHash, papel, setorId, pin: pinRaw || null, bancada: bancadaRaw || null },
    });
  await prisma.contaAcesso.upsert({
    where: { funcionarioId: id },
    update: {
      usuario,
      senhaHash,
      ...(senha ? { senhaTemporaria: senha } : {}),
      ativo: true,
    },
    create: {
      funcionarioId: id,
      usuario,
      senhaHash,
      senhaTemporaria: senha || contaAtual?.senhaTemporaria || "1234",
      ativo: true,
    },
  });
  await prisma.funcionarioProcesso.deleteMany({ where: { funcionarioId: id } });
  if (processos.length > 0) {
    await prisma.funcionarioProcesso.createMany({
      data: processos.map((processo) => ({ funcionarioId: id, processo })),
    });
  }
  await registrarAlteracao({ entidade: "FUNCIONARIO", entidadeId: id, acao: "ATUALIZADO", descricao: `Acesso do funcionário ${id} atualizado.`, usuario: acesso.nome, dadosDepois: { usuario, papel, setorId, bancada: bancadaRaw || null, processos } });

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
  if (!f.ativo && f.papel === "CONFERENTE") {
    const outro = await prisma.funcionario.findFirst({ where: { id: { not: id }, ativo: true, papel: "CONFERENTE" }, select: { nome: true } });
    if (outro) throw new Error(`O conferente do Plasma já é ${outro.nome}.`);
  }

  await prisma.funcionario.update({
    where: { id },
    data: { ativo: !f.ativo },
  });
  await prisma.contaAcesso.updateMany({
    where: { funcionarioId: id },
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
