"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { salvarImagem } from "@/lib/upload";
import { SUFIXO_MATERIAL } from "@/lib/labels";
import { PROCESSOS, processosDoForm } from "@/lib/processos";
import { etapasDoFormulario, roteiroPadraoDaPeca } from "@/lib/roteiro-peca";
import { ehSetor } from "@/lib/setores";
import { exigirAdministrador } from "@/lib/auth-operador";
function numeroOuNulo(formData: FormData, campo: string): number | null {
  const raw = String(formData.get(campo) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function createPeca(formData: FormData) {
  await exigirAdministrador();
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

  revalidatePath("/registros");
}

export async function updatePeca(id: number, formData: FormData) {
  await exigirAdministrador();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const medida = String(formData.get("medida") ?? "").trim();
  const setorId = Number(formData.get("setorId"));
  const tipoMaterial = String(formData.get("tipoMaterial") ?? "").trim();

  if (!codigo || !nome || !setorId) {
    throw new Error("Preencha código, nome e setor da peça.");
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

  await prisma.$transaction(async (tx) => {
    await tx.peca.update({
      where: { id },
      data: {
        codigo,
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
    await tx.pecaRoteiro.deleteMany({ where: { pecaId: id } });
    await tx.pecaRoteiro.createMany({
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
    await tx.pecaCurva.deleteMany({ where: { pecaId: id } });
    if (curvas.length > 0) {
      await tx.pecaCurva.createMany({ data: curvas });
    }
  });

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
  await exigirAdministrador();

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

  revalidatePath(`/registros/${modeloId}`);
  revalidatePath(`/registros/pecas/${pecaId}`);
  revalidatePath("/monitoramento");
  revalidatePath("/apontamentos");
}

export async function deletePeca(id: number) {
  await exigirAdministrador();
  try {
    await prisma.peca.delete({ where: { id } });
  } catch {
    throw new Error(
      "Não é possível excluir: esta peça está usada em algum modelo ou apontamento.",
    );
  }
  revalidatePath("/registros");
}

/**
 * Substitui a BOM (lista de peças) de um modelo pelo enviado no form.
 * Cada peça tem um input `qtd-<pecaId>` — vazio ou 0 = fora da BOM.
 */
export async function updateBOM(modeloId: number, formData: FormData) {
  await exigirAdministrador();
  const pecas = await prisma.peca.findMany({ select: { id: true } });

  const linhas = pecas
    .map((p) => ({
      pecaId: p.id,
      quantidadeNecessaria: Number(formData.get(`qtd-${p.id}`) ?? 0),
    }))
    .filter((l) => l.quantidadeNecessaria > 0);

  await prisma.$transaction([
    prisma.modeloPeca.deleteMany({ where: { modeloId } }),
    prisma.modeloPeca.createMany({
      data: linhas.map((l) => ({
        modeloId,
        pecaId: l.pecaId,
        quantidadeNecessaria: l.quantidadeNecessaria,
      })),
    }),
  ]);

  revalidatePath(`/registros/${modeloId}`);
  revalidatePath("/registros");
  revalidatePath("/agrupamento");
  revalidatePath("/");
  revalidatePath("/monitoramento");
}

export async function addPecaToEngate(modeloId: number, formData: FormData) {
  await exigirAdministrador();
  const setorId = Number(formData.get("setorId"));
  const tipoMaterial = String(formData.get("tipoMaterial") ?? "").trim();
  const medida = String(formData.get("medida") ?? "").trim();
  const quantidade = Number(formData.get("quantidade") ?? 1);

  if (!setorId || !tipoMaterial) {
    throw new Error("Preencha setor e tipo de material.");
  }

  const modelo = await prisma.modelo.findUnique({
    where: { id: modeloId },
    include: { pecas: { include: { peca: true } } },
  });
  if (!modelo) throw new Error("Modelo não encontrado.");

  const sufixo = SUFIXO_MATERIAL[tipoMaterial] ?? "OT";
  const pecasDoMesmoTipo = modelo.pecas.filter((p) =>
    p.peca.codigo.startsWith(`${modelo.codigo}-${sufixo}`)
  );
  const numero = pecasDoMesmoTipo.length > 0 ? pecasDoMesmoTipo.length + 1 : "";
  const codigoGerado = `${modelo.codigo}-${sufixo}${numero}`;

  await prisma.$transaction(async (tx) => {
    const peca = await tx.peca.create({
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

    const setores = await tx.setor.findMany({ select: { id: true, nome: true } });
    const etapas = roteiroPadraoDaPeca(peca, setores);
    if (etapas.length > 0) {
      await tx.pecaRoteiro.createMany({
        data: etapas.map(({ setorId: etapaSetorId, processo, ordem }) => ({
          pecaId: peca.id,
          setorId: etapaSetorId,
          processo,
          ordem,
        })),
      });
    }

    await tx.modeloPeca.create({
      data: {
        modeloId,
        pecaId: peca.id,
        quantidadeNecessaria: quantidade,
      },
    });
  });

  revalidatePath(`/registros/${modeloId}`);
  revalidatePath("/registros");
  revalidatePath("/agrupamento");
  revalidatePath("/");
  revalidatePath("/monitoramento");
}
