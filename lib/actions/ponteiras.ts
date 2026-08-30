"use server";

import { revalidatePath } from "next/cache";
import { exigirAdministrador, exigirUsuarioLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { componentesParaTamanho, normalizarTamanhoPonteira, TAMANHOS_PONTEIRA } from "@/lib/ponteiras";
import { registrarAlteracao } from "@/lib/auditoria";

function numeroNaoNegativo(valor: FormDataEntryValue | null, campo: string) {
  const numero = Number(String(valor ?? "").trim());
  if (!Number.isInteger(numero) || numero < 0) {
    throw new Error(`${campo} deve ser um número inteiro não negativo.`);
  }
  return numero;
}

export async function salvarEstoquePonteiras(formData: FormData) {
  const usuario = await exigirUsuarioLogado();
  if (!usuario.administrador && !["LIDER", "PCP"].includes(usuario.papel)) {
    throw new Error("Apenas liderança, PCP ou administrador podem atualizar o saldo de ponteiras.");
  }

  const tubosPequenaMedia = numeroNaoNegativo(
    formData.get("tubos-PM") ?? formData.get("tubos-PEQUENA"),
    "Tubos cortados de pequena/média",
  );
  const tubosGrande = numeroNaoNegativo(
    formData.get("tubos-G") ?? formData.get("tubos-GRANDE"),
    "Tubos cortados de grande",
  );

  const operacoes = TAMANHOS_PONTEIRA.map((tamanho) => {
    const quantidadePronta = numeroNaoNegativo(formData.get(`prontas-${tamanho.chave}`), "Estoque pronto");
    const chapasCortadas = numeroNaoNegativo(formData.get(`chapas-${tamanho.chave}`), "Chapas cortadas");
    const tubosCortados = tamanho.chave === "PEQUENA"
      ? tubosPequenaMedia
      : tamanho.chave === "GRANDE"
        ? tubosGrande
        : 0;

    return prisma.estoquePonteira.upsert({
      where: { tamanho: tamanho.chave },
      create: { tamanho: tamanho.chave, quantidadePronta, tubosCortados, chapasCortadas },
      update: { quantidadePronta, tubosCortados, chapasCortadas },
    });
  });
  await prisma.$transaction(operacoes);
  await registrarAlteracao({ entidade: "ESTOQUE", acao: "MOVIMENTADO", descricao: "Saldos de estoque das ponteiras macho atualizados.", usuario: usuario.nome, dadosDepois: { tubosPequenaMedia, tubosGrande } });

  revalidatePath("/ponteiras");
}

export async function salvarConfiguracaoPonteira(formData: FormData) {
  const usuario = await exigirAdministrador();
  const modeloId = Number(formData.get("modeloId"));
  const tamanho = normalizarTamanhoPonteira(String(formData.get("tamanho") ?? ""));

  if (!Number.isInteger(modeloId) || !tamanho) {
    throw new Error("Informe o modelo e o tamanho da ponteira.");
  }

  const modelo = await prisma.modelo.findUnique({
    where: { id: modeloId },
    select: { tipo: true },
  });
  if (!modelo || modelo.tipo !== "REMOVIVEL") {
    throw new Error("A configuração é exclusiva de engates removíveis.");
  }

  const componentes = componentesParaTamanho(tamanho);
  const pecas = await prisma.peca.findMany({
    where: { codigo: { in: [componentes.tubo.codigo, componentes.chapa.codigo] } },
    select: { id: true, codigo: true },
  });
  const pecaTuboId = pecas.find((peca) => peca.codigo === componentes.tubo.codigo)?.id;
  const pecaChapaId = pecas.find((peca) => peca.codigo === componentes.chapa.codigo)?.id;
  if (!pecaTuboId || !pecaChapaId) {
    throw new Error("Os componentes padronizados da ponteira ainda não foram cadastrados.");
  }

  await prisma.$transaction([
    prisma.modelo.update({ where: { id: modeloId }, data: { tamanhoPonteira: tamanho } }),
    prisma.configuracaoPonteira.upsert({
      where: { modeloId },
      create: { modeloId, pecaTuboId, pecaChapaId },
      update: { pecaTuboId, pecaChapaId },
    }),
  ]);
  await registrarAlteracao({ entidade: "BOM", entidadeId: modeloId, acao: "ATUALIZADO", descricao: `Configuração de ponteira ${tamanho} atualizada no modelo ${modeloId}.`, usuario: usuario.nome, dadosDepois: { pecaTuboId, pecaChapaId } });

  revalidatePath("/ponteiras");
  revalidatePath(`/registros/${modeloId}`);
}
