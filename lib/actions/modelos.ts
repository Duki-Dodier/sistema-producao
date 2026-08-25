"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { salvarImagem } from "@/lib/upload";
import { TIPO_MATERIAL_LABEL } from "@/lib/labels";
import { ehSetorFinal } from "@/lib/setores";
import { roteiroPadraoDaPeca } from "@/lib/roteiro-peca";
import type { Processo } from "@/lib/processos";
import { exigirAdministrador } from "@/lib/auth-operador";
import { proximoCodigoPeca } from "@/lib/codigos-peca";

const CURVAS_VALIDAS = new Set(["A", "B", "C"]);
const TIPOS_VALIDOS = new Set(["FIXO", "REMOVIVEL"]);
const LINHAS_VALIDAS = new Set(["BRUCKE", "REFORCEL"]);

function validarClassificacao(curva: string, tipo: string) {
  if (!CURVAS_VALIDAS.has(curva) || !TIPOS_VALIDOS.has(tipo)) {
    throw new Error("Curva ou tipo de engate inválido.");
  }
}

function validarLinhaProduto(linhaProduto: string) {
  if (!LINHAS_VALIDAS.has(linhaProduto)) {
    throw new Error("A linha do produto deve ser BRUCKE ou REFORCEL.");
  }
}

function parseRegulador(value: unknown, obrigatorio = false) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    if (obrigatorio) throw new Error("O regulador do produto é obrigatório.");
    return null;
  }

  const regulador = Number(raw);
  if (!Number.isInteger(regulador) || regulador < 0) {
    throw new Error("O regulador deve ser um número inteiro não negativo.");
  }
  return regulador;
}

export async function createModelo(formData: FormData) {
  await exigirAdministrador();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const curva = String(formData.get("curva") ?? "").trim().toUpperCase();
  const tipo = String(formData.get("tipo") ?? "").trim().toUpperCase();
  const linhaProduto = String(formData.get("linhaProduto") ?? "").trim().toUpperCase();
  const regulador = parseRegulador(formData.get("regulador"), true);
  const estoqueMinimoRaw = String(formData.get("estoqueMinimo") ?? "").trim();

  if (!codigo) throw new Error("Código do engate é obrigatório.");
  validarClassificacao(curva, tipo);
  validarLinhaProduto(linhaProduto);
  if (estoqueMinimoRaw && (!Number.isInteger(Number(estoqueMinimoRaw)) || Number(estoqueMinimoRaw) < 0)) {
    throw new Error("Estoque mínimo deve ser um número inteiro não negativo.");
  }

  const imagemUrl = await salvarImagem(formData.get("imagem"), "modelos");

  const modelo = await prisma.modelo.create({
    data: {
      codigo,
      nome: nome || null,
      curva,
      tipo,
      linhaProduto,
      regulador,
      estoqueMinimo: estoqueMinimoRaw ? Number(estoqueMinimoRaw) : null,
      imagemUrl,
    },
  });
  revalidatePath("/registros");
  revalidatePath("/modelos");
  revalidatePath("/ops");
  redirect(`/registros/${modelo.id}`);
}

/** Atualiza os dados de cadastro do engate (ficha técnica), incluindo a foto. */
export async function updateModeloFicha(modeloId: number, formData: FormData) {
  await exigirAdministrador();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const curva = String(formData.get("curva") ?? "").trim().toUpperCase();
  const tipo = String(formData.get("tipo") ?? "").trim().toUpperCase();
  const tamanhoPonteira = String(formData.get("tamanhoPonteira") ?? "").trim();
  const regulador = parseRegulador(formData.get("regulador"));
  const estoqueMinimoRaw = String(formData.get("estoqueMinimo") ?? "").trim();

  if (!codigo) throw new Error("Código do engate é obrigatório.");
  validarClassificacao(curva, tipo);
  if (estoqueMinimoRaw && (!Number.isInteger(Number(estoqueMinimoRaw)) || Number(estoqueMinimoRaw) < 0)) {
    throw new Error("Estoque mínimo deve ser um número inteiro não negativo.");
  }

  const novaImagem = await salvarImagem(formData.get("imagem"), "modelos");

  await prisma.modelo.update({
    where: { id: modeloId },
    data: {
      codigo,
      nome: nome || null,
      curva,
      tipo,
      tamanhoPonteira: tamanhoPonteira || null,
      regulador,
      estoqueMinimo: estoqueMinimoRaw ? Number(estoqueMinimoRaw) : null,
      ...(novaImagem ? { imagemUrl: novaImagem } : {}),
    },
  });

  revalidatePath(`/registros/${modeloId}`);
  revalidatePath("/registros");
  revalidatePath("/modelos");
  revalidatePath("/ops");
}

export async function deleteModelo(id: number) {
  await exigirAdministrador();
  try {
    await prisma.modelo.delete({ where: { id } });
  } catch {
    throw new Error(
      "Não é possível excluir: este modelo tem OPs vinculadas.",
    );
  }
  revalidatePath("/modelos");
  revalidatePath("/registros");
  redirect("/registros");
}

/**
 * Substitui o roteiro do modelo pelo enviado no form.
 * Cada setor tem um input `ordem-<setorId>` — vazio ou 0 = fora do roteiro.
 */
export async function updateRoteiro(modeloId: number, formData: FormData) {
  await exigirAdministrador();
  const setores = await prisma.setor.findMany({ select: { id: true } });

  const linhas = setores
    .map((s) => ({
      setorId: s.id,
      ordem: Number(formData.get(`ordem-${s.id}`) ?? 0),
    }))
    .filter((l) => l.ordem > 0)
    .sort((a, b) => a.ordem - b.ordem)
    .map((l, idx) => ({ ...l, ordem: idx + 1 })); // normaliza ordem sequencial

  await prisma.$transaction([
    prisma.modeloRoteiro.deleteMany({ where: { modeloId } }),
    prisma.modeloRoteiro.createMany({
      data: linhas.map((l) => ({ modeloId, setorId: l.setorId, ordem: l.ordem })),
    }),
  ]);

  revalidatePath(`/modelos/${modeloId}`);
  revalidatePath("/modelos");
  revalidatePath("/");
}

export type PecaInput = {
  materialId: string;
  setorId: number;
  comprimentoMm: number;
  larguraMm: number;
  espessuraMm: number;
  quantidade: number;
  operacoes: string[];
};

export async function createModeloComPecas(engate: FormData, pecas: PecaInput[]) {
  await exigirAdministrador();
  const codigo = String(engate.get("codigo") ?? "").trim();
  const nome = String(engate.get("nome") ?? "").trim();
  const curva = String(engate.get("curva") ?? "").trim().toUpperCase();
  const tipo = String(engate.get("tipo") ?? "").trim().toUpperCase();
  const linhaProduto = String(engate.get("linhaProduto") ?? "").trim().toUpperCase();
  const regulador = parseRegulador(engate.get("regulador"), true);
  
  if (!codigo) throw new Error("Código do engate é obrigatório.");
  validarClassificacao(curva, tipo);
  validarLinhaProduto(linhaProduto);
  if (pecas.some((peca) => !Number.isInteger(peca.setorId) || !Number.isInteger(peca.quantidade) || peca.quantidade <= 0)) {
    throw new Error("Cada peça precisa ter setor e quantidade inteira positiva.");
  }

  const imagemUrl = await salvarImagem(engate.get("imagem"), "modelos");
  const codigosExistentes = await prisma.peca.findMany({ select: { codigo: true } });

  await prisma.$transaction(async (tx) => {
    const modelo = await tx.modelo.create({
      data: {
        codigo,
        nome: nome || null,
        curva,
        tipo,
        linhaProduto,
        regulador,
        imagemUrl,
      }
    });

    const setoresDisponiveis = await tx.setor.findMany({ select: { id: true, nome: true } });
    const mapaOperacoes: Record<string, Processo> = {
      Bate: "BATIDA",
      Fura: "FURACAO",
      Amassa: "AMASSAR",
      "Corta em Grau": "CORTE_GRAU",
      Reto: "CORTE",
    };

    const codigosGerados = codigosExistentes.map((peca) => peca.codigo);
    for (let i = 0; i < pecas.length; i++) {
      const p = pecas[i];
      const pecaCodigo = proximoCodigoPeca(codigo, p.materialId, codigosGerados);
      codigosGerados.push(pecaCodigo);
      
      let dimText = "";
      if (p.materialId === "PLASMA") {
         dimText = `Esp:${p.espessuraMm}mm`;
      } else {
         dimText = `${p.comprimentoMm}x${p.larguraMm}x${p.espessuraMm}mm`;
      }
      
      const opText = p.operacoes && p.operacoes.length > 0 ? ` [${p.operacoes.join(", ")}]` : "";
      const nomeBase = TIPO_MATERIAL_LABEL[p.materialId] || p.materialId;
      const pecaNome = `${nomeBase} ${dimText}${opText}`;

      const processos = [
        "CORTE" as Processo,
        ...p.operacoes.map((operacao) => mapaOperacoes[operacao]).filter(Boolean),
      ].filter((processo, indice, lista) => lista.indexOf(processo) === indice);
      const peca = await tx.peca.create({
        data: {
          codigo: pecaCodigo,
          nome: pecaNome,
          tipoMaterial: p.materialId,
          comprimentoMm: p.comprimentoMm,
          medidaA: p.larguraMm,
          espessuraMm: p.espessuraMm,
          setorId: p.setorId,
          processos: processos.join(","),
        }
      });

      const etapasPeca = roteiroPadraoDaPeca(peca, setoresDisponiveis);
      if (etapasPeca.length > 0) {
        await tx.pecaRoteiro.createMany({
          data: etapasPeca.map(({ setorId, processo, ordem }) => ({
            pecaId: peca.id,
            setorId,
            processo,
            ordem,
          })),
        });
      }

      await tx.modeloPeca.create({
        data: {
          modeloId: modelo.id,
          pecaId: peca.id,
          quantidadeNecessaria: p.quantidade,
        }
      });
    }

    // Auto-gerar o roteiro padrão baseado nas peças + setores finais
    // 1. Pegar IDs únicos dos setores das peças
    const setoresPecasIds = [...new Set(pecas.map(p => p.setorId))];
    
    // 2. Buscar setores finais (Agrupamento, Solda, Pintura, Montagem)
    const setoresFinais = (await tx.setor.findMany()).filter((setor) =>
      ehSetorFinal(setor.nome),
    );
    const setoresFinaisIds = setoresFinais.map(s => s.id);

    // 3. Juntar todos os setores (peças + finais) sem duplicatas
    const todosSetoresIds = [...new Set([...setoresPecasIds, ...setoresFinaisIds])];

    // 4. Buscar a ordem padrão de todos eles no banco para ordenar corretamente
    const setoresOrdenados = await tx.setor.findMany({
      where: { id: { in: todosSetoresIds } },
      orderBy: { ordemPadrao: "asc" }
    });

    // 5. Criar o roteiro no banco de dados
    if (setoresOrdenados.length > 0) {
      await tx.modeloRoteiro.createMany({
        data: setoresOrdenados.map((s, idx) => ({
          modeloId: modelo.id,
          setorId: s.id,
          ordem: idx + 1
        }))
      });
    }
  });

  revalidatePath("/registros");
  revalidatePath("/modelos");
  revalidatePath("/ops");
  revalidatePath("/agrupamento");
  revalidatePath("/monitoramento");
}
