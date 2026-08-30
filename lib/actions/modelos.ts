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
import { normalizarTamanhoPonteira } from "@/lib/ponteiras";
import { registrarAlteracao } from "@/lib/auditoria";

const CURVAS_VALIDAS = new Set(["A", "B", "C"]);
const TIPOS_VALIDOS = new Set(["FIXO", "REMOVIVEL", "PONTEIRA_MACHO"]);
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

function parseEstoqueRegulador(value: unknown, obrigatorio = false) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    if (obrigatorio) throw new Error("O estoque regulador do produto é obrigatório.");
    return null;
  }

  const estoque = Number(raw);
  if (!Number.isInteger(estoque) || estoque < 0) {
    throw new Error("O estoque regulador deve ser um número inteiro não negativo.");
  }
  return estoque;
}

export async function createModelo(formData: FormData) {
  const usuario = await exigirAdministrador();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const curva = String(formData.get("curva") ?? "").trim().toUpperCase();
  const tipo = String(formData.get("tipo") ?? "").trim().toUpperCase();
  const linhaProduto = String(formData.get("linhaProduto") ?? "").trim().toUpperCase();
  const tamanhoPonteira = normalizarTamanhoPonteira(String(formData.get("tamanhoPonteira") ?? ""));
  const estoqueMinimo = parseEstoqueRegulador(formData.get("estoqueMinimo"));

  if (!codigo) throw new Error("Código do engate é obrigatório.");
  validarClassificacao(curva, tipo);
  if (tipo === "PONTEIRA_MACHO" && !tamanhoPonteira) {
    throw new Error("Informe o tamanho da ponteira macho: Pequena, Média ou Grande.");
  }
  validarLinhaProduto(linhaProduto);
  const imagemUrl = await salvarImagem(formData.get("imagem"), "modelos");

  const modelo = await prisma.modelo.create({
    data: {
      codigo,
      nome: nome || null,
      curva,
      tipo,
      tamanhoPonteira: tipo === "REMOVIVEL" || tipo === "PONTEIRA_MACHO" ? tamanhoPonteira : null,
      linhaProduto,
      estoqueMinimo,
      imagemUrl,
    },
  });
  await registrarAlteracao({ entidade: "MODELO", entidadeId: modelo.id, acao: "CRIADO", descricao: `Modelo ${codigo} cadastrado.`, usuario: usuario.nome, dadosDepois: { codigo, curva, tipo, linhaProduto, estoqueMinimo } });
  revalidatePath("/registros");
  revalidatePath("/modelos");
  revalidatePath("/ops");
  redirect(`/registros/${modelo.id}`);
}

/** Atualiza os dados de cadastro do engate (ficha técnica), incluindo a foto. */
export async function updateModeloFicha(modeloId: number, formData: FormData) {
  const usuario = await exigirAdministrador();
  const anterior = await prisma.modelo.findUnique({ where: { id: modeloId }, select: { codigo: true, curva: true, tipo: true, linhaProduto: true, estoqueMinimo: true } });
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const curva = String(formData.get("curva") ?? "").trim().toUpperCase();
  const tipo = String(formData.get("tipo") ?? "").trim().toUpperCase();
  const tamanhoInformado = String(formData.get("tamanhoPonteira") ?? "");
  const tamanhoPonteira = normalizarTamanhoPonteira(tamanhoInformado);
  const estoqueMinimo = parseEstoqueRegulador(formData.get("estoqueMinimo"));

  if (!codigo) throw new Error("Código do engate é obrigatório.");
  validarClassificacao(curva, tipo);
  if (tipo === "PONTEIRA_MACHO" && !tamanhoPonteira) {
    throw new Error("Informe o tamanho da ponteira macho: Pequena, Média ou Grande.");
  }
  if (tamanhoInformado.trim() && !tamanhoPonteira) {
    throw new Error("O tamanho da ponteira deve ser Pequena, Média ou Grande.");
  }
  const novaImagem = await salvarImagem(formData.get("imagem"), "modelos");

  await prisma.modelo.update({
    where: { id: modeloId },
    data: {
      codigo,
      nome: nome || null,
      curva,
      tipo,
      tamanhoPonteira: tipo === "REMOVIVEL" || tipo === "PONTEIRA_MACHO" ? tamanhoPonteira : null,
      estoqueMinimo,
      ...(novaImagem ? { imagemUrl: novaImagem } : {}),
    },
  });

  await registrarAlteracao({ entidade: "MODELO", entidadeId: modeloId, acao: "ATUALIZADO", descricao: `Ficha do modelo ${codigo} atualizada.`, usuario: usuario.nome, dadosAntes: anterior, dadosDepois: { codigo, curva, tipo, estoqueMinimo } });
  revalidatePath(`/registros/${modeloId}`);
  revalidatePath("/registros");
  revalidatePath("/modelos");
  revalidatePath("/ops");
}

export async function deleteModelo(id: number) {
  const usuario = await exigirAdministrador();
  const anterior = await prisma.modelo.findUnique({ where: { id }, select: { codigo: true } });
  try {
    await prisma.modelo.delete({ where: { id } });
  } catch {
    throw new Error(
      "Não é possível excluir: este modelo tem OPs vinculadas.",
    );
  }
  await registrarAlteracao({ entidade: "MODELO", entidadeId: id, acao: "EXCLUIDO", descricao: `Modelo ${anterior?.codigo ?? id} excluído.`, usuario: usuario.nome });
  revalidatePath("/modelos");
  revalidatePath("/registros");
  redirect("/registros");
}

/**
 * Substitui o roteiro do modelo pelo enviado no form.
 * Cada setor tem um input `ordem-<setorId>` — vazio ou 0 = fora do roteiro.
 */
export async function updateRoteiro(modeloId: number, formData: FormData) {
  const usuario = await exigirAdministrador();
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
  await registrarAlteracao({ entidade: "ROTEIRO", entidadeId: modeloId, acao: "ATUALIZADO", descricao: `Roteiro do modelo ${modeloId} atualizado com ${linhas.length} etapas.`, usuario: usuario.nome, dadosDepois: linhas });

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
  const usuario = await exigirAdministrador();
  const codigo = String(engate.get("codigo") ?? "").trim();
  const nome = String(engate.get("nome") ?? "").trim();
  const curva = String(engate.get("curva") ?? "").trim().toUpperCase();
  const tipo = String(engate.get("tipo") ?? "").trim().toUpperCase();
  const linhaProduto = String(engate.get("linhaProduto") ?? "").trim().toUpperCase();
  const tamanhoPonteira = normalizarTamanhoPonteira(String(engate.get("tamanhoPonteira") ?? ""));
  const estoqueMinimo = parseEstoqueRegulador(engate.get("estoqueMinimo"));
  
  if (!codigo) throw new Error("Código do engate é obrigatório.");
  validarClassificacao(curva, tipo);
  if (tipo === "PONTEIRA_MACHO" && !tamanhoPonteira) {
    throw new Error("Informe o tamanho da ponteira macho: Pequena, Média ou Grande.");
  }
  validarLinhaProduto(linhaProduto);
  if (pecas.some((peca) => !Number.isInteger(peca.setorId) || !Number.isInteger(peca.quantidade) || peca.quantidade <= 0)) {
    throw new Error("Cada peça precisa ter setor e quantidade inteira positiva.");
  }

  const imagemUrl = await salvarImagem(engate.get("imagem"), "modelos");
  const codigosExistentes = await prisma.peca.findMany({ select: { codigo: true } });

  const modelo = await prisma.modelo.create({
      data: {
        codigo,
        nome: nome || null,
      curva,
      tipo,
      tamanhoPonteira: tipo === "REMOVIVEL" || tipo === "PONTEIRA_MACHO" ? tamanhoPonteira : null,
      linhaProduto,
        estoqueMinimo,
        imagemUrl,
      }
  });
  await registrarAlteracao({ entidade: "MODELO", entidadeId: modelo.id, acao: "CRIADO", descricao: `Modelo ${codigo} cadastrado.`, usuario: usuario.nome, dadosDepois: { codigo, curva, tipo, linhaProduto, estoqueMinimo } });

    const setoresDisponiveis = await prisma.setor.findMany({ select: { id: true, nome: true } });
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
      const peca = await prisma.peca.create({
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
        await prisma.pecaRoteiro.createMany({
          data: etapasPeca.map(({ setorId, processo, ordem }) => ({
            pecaId: peca.id,
            setorId,
            processo,
            ordem,
          })),
        });
      }

      await prisma.modeloPeca.create({
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
    const setoresFinais = (await prisma.setor.findMany()).filter((setor) =>
      ehSetorFinal(setor.nome),
    );
    const setoresFinaisIds = setoresFinais.map(s => s.id);

    // 3. Juntar todos os setores (peças + finais) sem duplicatas
    const todosSetoresIds = [...new Set([...setoresPecasIds, ...setoresFinaisIds])];

    // 4. Buscar a ordem padrão de todos eles no banco para ordenar corretamente
    const setoresOrdenados = await prisma.setor.findMany({
      where: { id: { in: todosSetoresIds } },
      orderBy: { ordemPadrao: "asc" }
    });

    // 5. Criar o roteiro no banco de dados
    if (setoresOrdenados.length > 0) {
      await prisma.modeloRoteiro.createMany({
        data: setoresOrdenados.map((s, idx) => ({
          modeloId: modelo.id,
          setorId: s.id,
          ordem: idx + 1
        }))
      });
    }

  revalidatePath("/registros");
  revalidatePath("/modelos");
  revalidatePath("/ops");
  revalidatePath("/agrupamento");
  revalidatePath("/monitoramento");
}
