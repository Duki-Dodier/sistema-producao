"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { salvarImagem } from "@/lib/upload";
import { proximoCodigoPeca } from "@/lib/codigos-peca";
import { PROCESSOS, processosDoForm } from "@/lib/processos";
import { etapasDoFormulario, roteiroPadraoDaPeca } from "@/lib/roteiro-peca";
import { ehSetor } from "@/lib/setores";
import { exigirAdministrador } from "@/lib/auth-operador";
import { registrarAlteracao } from "@/lib/auditoria";
function numeroOuNulo(formData: FormData, campo: string): number | null {
  const raw = String(formData.get(campo) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function createPeca(formData: FormData) {
  const usuario = await exigirAdministrador();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const medida = String(formData.get("medida") ?? "").trim();
  const setorId = Number(formData.get("setorId"));
  const tipoMaterial = String(formData.get("tipoMaterial") ?? "").trim();

  if (!codigo || !nome || !setorId) {
    throw new Error("Preencha código, nome e setor da peça.");
  }

  const imagemUrl = await salvarImagem(formData.get("imagem"), "pecas");

  const processos = processosDoForm(formData);
  const peca = await prisma.peca.create({
    data: {
      codigo,
      nome,
      medida: medida || null,
      setorId,
      imagemUrl,
      tipoMaterial: tipoMaterial || null,
      medidaA: numeroOuNulo(formData, "medidaA"),
      medidaB: numeroOuNulo(formData, "medidaB"),
      espessuraMm: numeroOuNulo(formData, "espessuraMm"),
      comprimentoMm: numeroOuNulo(formData, "comprimentoMm"),
      processos,
    },
  });
  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  const etapas = roteiroPadraoDaPeca(
    {
      setorId,
      nome,
      tipoMaterial: tipoMaterial || null,
      medidaA: numeroOuNulo(formData, "medidaA"),
      espessuraMm: numeroOuNulo(formData, "espessuraMm"),
      processos,
    },
    setores,
  );
  if (etapas.length > 0) {
    await prisma.pecaRoteiro.createMany({
      data: etapas.map(({ setorId: etapaSetorId, processo, ordem }) => ({
        pecaId: peca.id,
        setorId: etapaSetorId,
        processo,
        ordem,
      })),
    });
  }

  await registrarAlteracao({ entidade: "BOM", entidadeId: peca.id, acao: "CRIADO", descricao: `Peça ${codigo} cadastrada.`, usuario: usuario.nome, dadosDepois: { codigo, nome, setorId, tipoMaterial, processos } });

  revalidatePath("/registros");
}

export async function updatePeca(id: number, formData: FormData) {
  const usuario = await exigirAdministrador();
  const nome = String(formData.get("nome") ?? "").trim();
  const medida = String(formData.get("medida") ?? "").trim();
  const setorId = Number(formData.get("setorId"));
  const tipoMaterial = String(formData.get("tipoMaterial") ?? "").trim();
  const pecaAtual = await prisma.peca.findUnique({
    where: { id },
    select: { codigo: true },
  });

  if (!pecaAtual || !nome || !setorId) {
    throw new Error("Preencha nome e setor da peça.");
  }

  const novaImagem = await salvarImagem(formData.get("imagem"), "pecas");
  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  let etapas = etapasDoFormulario(formData);
  if (etapas.some((etapa) => !PROCESSOS.includes(etapa.processo))) {
    throw new Error("O roteiro contém um processo inválido.");
  }
  if (etapas.length === 0) {
    etapas = roteiroPadraoDaPeca(
      {
        setorId,
        nome,
        tipoMaterial: tipoMaterial || null,
        medidaA: numeroOuNulo(formData, "medidaA"),
        espessuraMm: numeroOuNulo(formData, "espessuraMm"),
        processos: processosDoForm(formData),
      },
      setores,
    );
  }
  const agrupamento = setores.find((setor) => ehSetor(setor.nome, "Agrupamento"));
  if (agrupamento && etapas.at(-1)?.processo !== "AGRUPAR") {
    etapas.push({ setorId: agrupamento.id, processo: "AGRUPAR", ordem: etapas.length + 1 });
  }
  etapas = etapas.map((etapa, indice) => ({ ...etapa, ordem: indice + 1 }));
  const processosSetorPrincipal = etapas
    .filter((etapa) => etapa.setorId === setorId && etapa.processo !== "AGRUPAR")
    .map((etapa) => etapa.processo)
    .join(",");

  await prisma.peca.update({
      where: { id },
      data: {
        codigo: pecaAtual.codigo,
        nome,
        medida: medida || null,
        setorId,
        tipoMaterial: tipoMaterial || null,
        medidaA: numeroOuNulo(formData, "medidaA"),
        medidaB: numeroOuNulo(formData, "medidaB"),
        espessuraMm: numeroOuNulo(formData, "espessuraMm"),
        comprimentoMm: numeroOuNulo(formData, "comprimentoMm"),
        processos: processosSetorPrincipal || null,
        observacao: String(formData.get("observacao") ?? "").trim() || null,
        ...(novaImagem ? { imagemUrl: novaImagem } : {}),
      },
    });
  await prisma.pecaRoteiro.deleteMany({ where: { pecaId: id } });
  await prisma.pecaRoteiro.createMany({
      data: etapas.map((etapa) => ({ ...etapa, pecaId: id })),
    });

    // Curvas de dobra: substitui pelo que veio do form (linhas vazias saem).
    const medidas = formData.getAll("curvaMedida").map(String);
    const angulos = formData.getAll("curvaAngulo").map(String);
    const quantidades = formData.getAll("curvaQuantidade").map(String);
    const maquinas = formData.getAll("curvaMaquina").map(String);
    const curvas = medidas
      .map((medidaCm, i) => ({
        medidaCm: medidaCm.trim() ? Number(medidaCm) : null,
        anguloGraus: (angulos[i] ?? "").trim() ? Number(angulos[i]) : null,
        quantidade: (quantidades[i] ?? "").trim() ? Number(quantidades[i]) : 1,
        maquina: (maquinas[i] ?? "").trim() || null,
      }))
      .filter((c) => c.medidaCm !== null || c.anguloGraus !== null || c.maquina !== null)
      .map((c, i) => ({ ...c, ordem: i + 1, pecaId: id }));
  await prisma.pecaCurva.deleteMany({ where: { pecaId: id } });
    if (curvas.length > 0) {
      await prisma.pecaCurva.createMany({ data: curvas });
    }

  await registrarAlteracao({ entidade: "BOM", entidadeId: id, acao: "ATUALIZADO", descricao: `Peça ${pecaAtual.codigo} atualizada.`, usuario: usuario.nome, dadosDepois: { nome, setorId, tipoMaterial, etapas: etapas.length, curvas: curvas.length } });
  revalidatePath("/registros");
  revalidatePath(`/registros/pecas/${id}`);
  revalidatePath("/apontamentos");
  revalidatePath("/monitoramento");
}

/** Atualiza somente as medidas exibidas na ficha técnica do modelo. */
export async function updatePecaMedidas(
  pecaId: number,
  modeloId: number,
  formData: FormData,
) {
  const usuario = await exigirAdministrador();

  const medida = String(formData.get("medida") ?? "").trim();
  const medidaA = numeroOuNulo(formData, "medidaA");
  const medidaB = numeroOuNulo(formData, "medidaB");
  const espessuraMm = numeroOuNulo(formData, "espessuraMm");
  const comprimentoMm = numeroOuNulo(formData, "comprimentoMm");

  if (!medida && medidaA === null && medidaB === null && espessuraMm === null && comprimentoMm === null) {
    throw new Error("Informe pelo menos uma medida da peça.");
  }

  await prisma.peca.update({
    where: { id: pecaId },
    data: {
      medida: medida || null,
      medidaA,
      medidaB,
      espessuraMm,
      comprimentoMm,
    },
  });

  await registrarAlteracao({ entidade: "BOM", entidadeId: pecaId, acao: "ATUALIZADO", descricao: `Medidas da peça ${pecaId} atualizadas.`, usuario: usuario.nome, dadosDepois: { medida, medidaA, medidaB, espessuraMm, comprimentoMm } });

  revalidatePath(`/registros/${modeloId}`);
  revalidatePath(`/registros/pecas/${pecaId}`);
  revalidatePath("/monitoramento");
  revalidatePath("/apontamentos");
}

/** Atualiza os processos cadastrados para a peça na ficha técnica. */
export async function updatePecaProcessos(
  pecaId: number,
  modeloId: number,
  formData: FormData,
) {
  const usuario = await exigirAdministrador();

  const processos = processosDoForm(formData);
  if (!processos) {
    throw new Error("Selecione pelo menos um processo da peça.");
  }

  await prisma.peca.update({
    where: { id: pecaId },
    data: { processos },
  });

  await registrarAlteracao({ entidade: "BOM", entidadeId: pecaId, acao: "ATUALIZADO", descricao: `Processos da peça ${pecaId} atualizados.`, usuario: usuario.nome, dadosDepois: { processos } });

  revalidatePath(`/registros/${modeloId}`);
  revalidatePath(`/registros/pecas/${pecaId}`);
  revalidatePath("/monitoramento");
  revalidatePath("/apontamentos");
}

export async function deletePeca(id: number) {
  const usuario = await exigirAdministrador();
  const anterior = await prisma.peca.findUnique({ where: { id }, select: { codigo: true } });
  try {
    await prisma.peca.delete({ where: { id } });
  } catch {
    throw new Error(
      "Não é possível excluir: esta peça está usada em algum modelo ou apontamento.",
    );
  }
  await registrarAlteracao({ entidade: "BOM", entidadeId: id, acao: "EXCLUIDO", descricao: `Peça ${anterior?.codigo ?? id} excluída.`, usuario: usuario.nome });
  revalidatePath("/registros");
}

/**
 * Substitui a BOM (lista de peças) de um modelo pelo enviado no form.
 * Cada peça tem um input `qtd-<pecaId>` — vazio ou 0 = fora da BOM.
 */
export async function updateBOM(modeloId: number, formData: FormData) {
  const usuario = await exigirAdministrador();
  const pecas = await prisma.peca.findMany({ select: { id: true } });

  const linhas = pecas
    .map((p) => ({
      pecaId: p.id,
      quantidadeNecessaria: Number(formData.get(`qtd-${p.id}`) ?? 0),
    }))
    .filter((l) => l.quantidadeNecessaria > 0);

  const dados = linhas.map((l) => ({ modeloId, pecaId: l.pecaId, quantidadeNecessaria: l.quantidadeNecessaria }));
  const operacoes = [prisma.modeloPeca.deleteMany({ where: { modeloId } })];
  // D1 limita o número de variáveis por instrução; mantém a BOM em lotes seguros.
  for (let indice = 0; indice < dados.length; indice += 150) {
    operacoes.push(prisma.modeloPeca.createMany({ data: dados.slice(indice, indice + 150) }));
  }
  await prisma.$transaction(operacoes);

  await registrarAlteracao({ entidade: "BOM", entidadeId: modeloId, acao: "ATUALIZADO", descricao: `BOM do modelo ${modeloId} atualizada com ${linhas.length} itens.`, usuario: usuario.nome, dadosDepois: linhas });

  revalidatePath(`/registros/${modeloId}`);
  revalidatePath("/registros");
  revalidatePath("/agrupamento");
  revalidatePath("/");
  revalidatePath("/monitoramento");
}

export async function addPecaToEngate(modeloId: number, formData: FormData) {
  const usuario = await exigirAdministrador();
  const setorId = Number(formData.get("setorId"));
  const tipoMaterial = String(formData.get("tipoMaterial") ?? "").trim();
  const medida = String(formData.get("medida") ?? "").trim();
  const quantidade = Number(formData.get("quantidade") ?? 1);

  if (!setorId || !tipoMaterial) {
    throw new Error("Preencha setor e tipo de material.");
  }

  const modelo = await prisma.modelo.findUnique({
    where: { id: modeloId },
    select: { id: true, codigo: true },
  });
  if (!modelo) throw new Error("Modelo não encontrado.");

  const codigosExistentes = await prisma.peca.findMany({ select: { codigo: true } });
  const codigoGerado = proximoCodigoPeca(
    modelo.codigo,
    tipoMaterial,
    codigosExistentes.map((item) => item.codigo),
  );

  const peca = await prisma.peca.create({
      data: {
        codigo: codigoGerado,
        nome: `${tipoMaterial} ${medida}`.trim(),
        medida: medida || null,
        setorId,
        tipoMaterial,
        medidaA: numeroOuNulo(formData, "medidaA"),
        medidaB: numeroOuNulo(formData, "medidaB"),
        espessuraMm: numeroOuNulo(formData, "espessuraMm"),
        comprimentoMm: numeroOuNulo(formData, "comprimentoMm"),
        processos: processosDoForm(formData),
      },
    });

    const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
    const etapas = roteiroPadraoDaPeca(peca, setores);
    if (etapas.length > 0) {
      await prisma.pecaRoteiro.createMany({
        data: etapas.map(({ setorId: etapaSetorId, processo, ordem }) => ({
          pecaId: peca.id,
          setorId: etapaSetorId,
          processo,
          ordem,
        })),
      });
    }

    await prisma.modeloPeca.create({
      data: {
        modeloId,
        pecaId: peca.id,
        quantidadeNecessaria: quantidade,
      },
    });

    await registrarAlteracao({ entidade: "BOM", entidadeId: modeloId, acao: "ATUALIZADO", descricao: `Peça ${codigoGerado} adicionada à BOM do modelo ${modelo.codigo}.`, usuario: usuario.nome, dadosDepois: { pecaId: peca.id, quantidade } });

  revalidatePath(`/registros/${modeloId}`);
  revalidatePath("/registros");
  revalidatePath("/agrupamento");
  revalidatePath("/");
  revalidatePath("/monitoramento");
}
