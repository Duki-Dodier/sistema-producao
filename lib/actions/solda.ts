"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ehSetor } from "@/lib/setores";
import { exigirUsuarioLogado } from "@/lib/auth-operador";

function revalidarSolda() {
  revalidatePath("/solda");
  revalidatePath("/agrupamento");
  revalidatePath("/");
  revalidatePath("/monitoramento");
}

export type ResultadoEnvioSolda =
  | { ok: true }
  | { ok: false; error: string };

export async function createApontamentoSolda(formData: FormData): Promise<ResultadoEnvioSolda> {
  try {
    await exigirUsuarioLogado();
    const opId = Number(formData.get("opId"));
    const soldador = String(formData.get("soldador") ?? "").trim();
    const bancada = String(formData.get("bancada") ?? "").trim();
    const abastecedor = String(formData.get("abastecedor") ?? "").trim();
    const quantidadeBoa = Number(formData.get("quantidadeBoa") ?? 0);
    const dataInformada = String(formData.get("data") ?? "").trim();

    if (!Number.isInteger(opId) || !soldador || !bancada) {
      throw new Error("Preencha OP, soldador e bancada.");
    }
    if (!Number.isInteger(quantidadeBoa) || quantidadeBoa <= 0) {
      throw new Error("Informe uma quantidade inteira positiva.");
    }

    // O adaptador Prisma do Cloudflare D1 nao oferece transacoes interativas.
    // Validamos com leituras diretas e fazemos uma unica gravacao, como no
    // apontamento comum, evitando o erro de Server Components no envio.
    const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
    const setorSolda = setores.find((setor) => ehSetor(setor.nome, "Solda"));
    if (!setorSolda) throw new Error('Setor "Solda" nao esta cadastrado.');

    const op = await prisma.oP.findUnique({
      where: { id: opId },
      select: {
        quantidade: true,
        status: true,
        modelo: { select: { roteiro: { select: { setorId: true } } } },
      },
    });
    if (!op) throw new Error("OP nao encontrada.");
    if (op.status !== "ABERTA") throw new Error("So e possivel enviar uma OP aberta para Solda.");
    if (!op.modelo.roteiro.some((etapa) => etapa.setorId === setorSolda.id)) {
      throw new Error("A OP nao possui Solda no roteiro.");
    }

    // A soma em JavaScript evita o aggregate com filtro de nulo, que falha
    // de forma intermitente em algumas versoes do adaptador D1.
    const enviosAnteriores = await prisma.apontamento.findMany({
      where: { opId, setorId: setorSolda.id },
      select: { quantidadeBoa: true, soldador: true },
    });
    const totalEnviado = enviosAnteriores
      .filter((apontamento) => apontamento.soldador !== null)
      .reduce((total, apontamento) => total + apontamento.quantidadeBoa, 0);
    const saldo = op.quantidade - totalEnviado;
    if (saldo <= 0) throw new Error("Esta OP ja foi totalmente enviada para Solda.");
    if (quantidadeBoa > saldo) {
      throw new Error(`Quantidade maior que o saldo da OP: restam ${saldo} peca(s).`);
    }

    await prisma.apontamento.create({
      data: {
        opId,
        setorId: setorSolda.id,
        usuario: soldador,
        soldador,
        bancada,
        abastecedor: abastecedor || null,
        quantidadeBoa,
        ...(dataInformada ? { dataHora: new Date(`${dataInformada}T12:00:00`) } : {}),
      },
    });
    revalidarSolda();
    return { ok: true };
  } catch (error) {
    console.error("Falha ao enviar OP para Solda", error);
    return {
      ok: false,
      error: error instanceof Error && error.message
        ? error.message
        : "Nao foi possivel enviar a OP para Solda. Tente novamente.",
    };
  }
}

export async function updateQuantidadeSoldada(envioId: number, formData: FormData) {
  await exigirUsuarioLogado();
  const quantidadeSoldada = Number(formData.get("quantidadeSoldada") ?? 0);
  if (!Number.isInteger(envioId) || !Number.isInteger(quantidadeSoldada) || quantidadeSoldada < 0) {
    throw new Error("Quantidade soldada invalida.");
  }
  const envio = await prisma.apontamento.findUnique({ where: { id: envioId }, select: { quantidadeBoa: true } });
  if (!envio) throw new Error("Envio nao encontrado.");
  if (quantidadeSoldada > envio.quantidadeBoa) throw new Error("Quantidade soldada maior que a abastecida neste envio.");
  await prisma.apontamento.update({ where: { id: envioId }, data: { quantidadeSoldada } });
  revalidarSolda();
}
