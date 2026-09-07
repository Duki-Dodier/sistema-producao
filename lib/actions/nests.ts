"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/app/generated/prisma/client";
import { exigirUsuarioLogado, type OperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { salvarPdf } from "@/lib/upload";
import { registrarAlteracao } from "@/lib/auditoria";
import { buscarDemandaPlasma } from "@/lib/plasma-saldo";
import { podeConferirPlasma } from "@/lib/plasma-regras";
import { buscarAvisoReposicaoPlasma, eventoReposicaoSolicitada, eventoReposicaoVisualizada } from "@/lib/plasma-reposicao-aviso";

type StatusNest = "PROGRAMADO" | "EM_CORTE" | "PAUSADO" | "CONCLUIDO" | "CANCELADO";
const EVENTOS_NEST = ["INICIO", "PAUSA", "RETORNO", "FIM", "CANCELAMENTO"] as const;

export type ResultadoEventoNest =
  | { ok: true; tipo: string; faltasEnviadas?: number }
  | { ok: false; mensagem: string };

export type ResultadoLancamentoNest =
  | { ok: true }
  | { ok: false; mensagem: string };

export type ResultadoConferenciaNest =
  | { ok: true }
  | { ok: false; mensagem: string };

function texto(valor: FormDataEntryValue | null, limite: number) {
  return String(valor ?? "").trim().slice(0, limite);
}

function ehRedirecionamento(erro: unknown) {
  if (!erro || typeof erro !== "object" || !("digest" in erro)) return false;
  return String(erro.digest).startsWith("NEXT_REDIRECT");
}

function mensagemDoErro(erro: unknown, padrao: string) {
  return erro instanceof Error && erro.message ? erro.message : padrao;
}

function inteiro(valor: FormDataEntryValue | null, campo: string, minimo = 0) {
  const numero = Number(texto(valor, 32));
  if (!Number.isInteger(numero) || numero < minimo) {
    throw new Error(`${campo} deve ser um número inteiro ${minimo > 0 ? "maior que zero" : "não negativo"}.`);
  }
  return numero;
}

function decimalOpcional(valor: FormDataEntryValue | null, campo: string) {
  const bruto = texto(valor, 32).replace(",", ".");
  if (!bruto) return null;
  const numero = Number(bruto);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${campo} deve ser um número não negativo.`);
  }
  return numero;
}

function segundosOpcional(valor: FormDataEntryValue | null, campo: string) {
  const bruto = texto(valor, 32);
  if (!bruto) return null;
  const numero = Number(bruto);
  if (!Number.isInteger(numero) || numero < 0) {
    throw new Error(`${campo} deve ser informado em segundos.`);
  }
  return numero;
}

function inteiroOpcional(valor: FormDataEntryValue | null, campo: string) {
  const bruto = texto(valor, 32);
  if (!bruto) return null;
  return inteiro(bruto, campo);
}

function setorEhPlasma(nome: string) {
  return ehSetor(nome, "Plasma Chapa") || ehSetor(nome, "Plasma Tubo");
}

function validarAcessoAoSetor(usuario: OperadorLogado, setor: { id: number; nome: string }) {
  if (!setorEhPlasma(setor.nome)) {
    throw new Error("O nest deve pertencer ao Plasma Chapa ou ao Plasma Tubo.");
  }
  if (!usuario.administrador && usuario.papel !== "PCP" && usuario.setorId !== setor.id) {
    throw new Error("Este usuário só pode registrar atividades do próprio setor.");
  }
  if (usuario.papel === "CONFERENTE") {
    throw new Error("O conferente registra apenas a conferência final do Plasma.");
  }
}

function revalidarNests() {
  revalidatePath("/plasma");
  revalidatePath("/apontamentos");
  revalidatePath("/monitoramento");
  revalidatePath("/ponteiras");
  revalidatePath("/agrupamento");
  revalidatePath("/ops");
  revalidatePath("/");
}

type ItemInformado = { opId: number; pecaId: number; quantidadePlanejada: number };

function lerItens(formData: FormData) {
  const referencias = formData.getAll("itemRef");
  const quantidades = formData.getAll("itemQuantidade");
  const itens = new Map<string, ItemInformado>();

  referencias.forEach((referencia, indice) => {
    const valor = String(referencia);
    if (!valor) return;
    const [opRaw, pecaRaw] = valor.split(":");
    const opId = Number(opRaw);
    const pecaId = Number(pecaRaw);
    const quantidadePlanejada = inteiro(quantidades[indice] ?? null, "Quantidade planejada", 1);
    if (!Number.isInteger(opId) || !Number.isInteger(pecaId)) {
      throw new Error("Há uma peça inválida na programação do nest.");
    }
    const chave = `${opId}:${pecaId}`;
    const atual = itens.get(chave);
    itens.set(chave, {
      opId,
      pecaId,
      quantidadePlanejada: (atual?.quantidadePlanejada ?? 0) + quantidadePlanejada,
    });
  });

  if (!itens.size) throw new Error("Inclua pelo menos uma peça de uma OP aberta no nest.");
  return [...itens.values()];
}

export async function criarNestCorte(formData: FormData) {
  const usuario = await exigirUsuarioLogado();
  const codigo = texto(formData.get("codigo"), 80).toUpperCase();
  const setorId = inteiro(formData.get("setorId"), "Setor", 1);
  const maquinaIdInformada = texto(formData.get("maquinaId"), 32);
  const maquinaId = maquinaIdInformada ? Number(maquinaIdInformada) : null;
  const itens = lerItens(formData);

  if (!codigo) throw new Error("Informe o código do nest, por exemplo NEST3530.");

  const setor = await prisma.setor.findUnique({ where: { id: setorId }, select: { id: true, nome: true } });
  if (!setor) throw new Error("Setor não encontrado.");
  validarAcessoAoSetor(usuario, setor);

  const maquina = maquinaId && Number.isInteger(maquinaId)
    ? await prisma.maquina.findFirst({ where: { id: maquinaId, setorId, ativo: true }, select: { id: true } })
    : null;
  if (!maquina) throw new Error("Selecione uma máquina ativa cadastrada. A importação não cria máquinas.");

  const demanda = await buscarDemandaPlasma();
  for (const item of itens) {
    const saldo = demanda.find(d => d.opId === item.opId && d.pecaId === item.pecaId && d.setorId === setorId);
    if (!saldo || item.quantidadePlanejada > saldo.disponivel) {
      throw new Error(`Saldo disponível para ${saldo?.codigo ?? "esta peça"}: ${saldo?.disponivel ?? 0}. Considere os NESTs já programados e os cortes aguardando conferência.`);
    }
  }

  const ops = await prisma.oP.findMany({
    where: { id: { in: itens.map((item) => item.opId) }, status: "ABERTA" },
    select: {
      id: true,
      modelo: {
        select: {
          pecas: {
            select: {
              pecaId: true,
              peca: {
                select: {
                  setorId: true,
                  roteiro: { select: { setorId: true, processo: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (ops.length !== new Set(itens.map((item) => item.opId)).size) {
    throw new Error("Todas as peças precisam pertencer a OPs abertas.");
  }

  for (const item of itens) {
    const op = ops.find((registro) => registro.id === item.opId);
    const componente = op?.modelo.pecas.find((peca) => peca.pecaId === item.pecaId)?.peca;
    const previstoNoSetor = componente?.setorId === setorId || componente?.roteiro.some(
      (etapa) => etapa.setorId === setorId && etapa.processo.toUpperCase().includes("CORTE"),
    );
    if (!previstoNoSetor) {
      throw new Error("Uma das peças selecionadas não possui corte previsto neste setor de plasma.");
    }
  }

  const agora = new Date();
  const arquivoPdfUrl = await salvarPdf(formData.get("arquivoPdf"), "nests", codigo);
  const nest = await prisma.nestCorte.create({
    data: {
      codigo,
      nomeArquivo: texto(formData.get("nomeArquivo"), 160) || null,
      arquivoPdfUrl,
      setorId,
      maquinaId: maquina.id,
      programadorId: usuario.id,
      material: texto(formData.get("material"), 80) || "Aço",
      espessuraMm: decimalOpcional(formData.get("espessuraMm"), "Espessura"),
      larguraChapaMm: decimalOpcional(formData.get("larguraChapaMm"), "Largura da chapa"),
      alturaChapaMm: decimalOpcional(formData.get("alturaChapaMm"), "Altura da chapa"),
      pesoChapaKg: decimalOpcional(formData.get("pesoChapaKg"), "Peso da chapa"),
      pesoPecasKg: decimalOpcional(formData.get("pesoPecasKg"), "Peso das peças"),
      pesoSobraKg: decimalOpcional(formData.get("pesoSobraKg"), "Peso da sobra"),
      aproveitamentoPct: decimalOpcional(formData.get("aproveitamentoPct"), "Aproveitamento"),
      quantidadeChapas: inteiro(formData.get("quantidadeChapas"), "Quantidade de chapas", 1),
      numeroPiercings: inteiroOpcional(formData.get("numeroPiercings"), "Número de furos") ?? undefined,
      comprimentoCorteMm: decimalOpcional(formData.get("comprimentoCorteMm"), "Comprimento de corte"),
      comprimentoRapidoMm: decimalOpcional(formData.get("comprimentoRapidoMm"), "Movimento rápido"),
      tempoCorteSegundos: segundosOpcional(formData.get("tempoCorteSegundos"), "Tempo de corte"),
      tempoDeslocamentoSegundos: segundosOpcional(formData.get("tempoDeslocamentoSegundos"), "Tempo de deslocamento"),
      observacao: texto(formData.get("observacao"), 800) || null,
      itens: { create: itens },
    },
  });
  await prisma.nestEvento.create({
    data: {
      nestId: nest.id,
      funcionarioId: usuario.id,
      tipo: "PROGRAMADO",
      descricao: "Nest programado e aguardando início do corte.",
      dataHora: agora,
    },
  });
  await registrarAlteracao({ entidade: "NEST", entidadeId: nest.id, acao: "CRIADO", descricao: `Nest ${codigo} programado.`, usuario: usuario.nome, dadosDepois: { setorId, maquinaId: maquina.id, itens: itens.length } });

  revalidarNests();
}

export async function refazerNest(formData: FormData) {
  const usuario = await exigirUsuarioLogado();
  const nestId = inteiro(formData.get("nestId"), "Nest", 1);
  const motivo = texto(formData.get("motivo"), 500);
  const refazerTudo = texto(formData.get("quantidade"), 16).toUpperCase() === "TOTAL";

  const origem = await prisma.nestCorte.findUnique({
    where: { id: nestId },
    select: {
      id: true,
      codigo: true,
      nomeArquivo: true,
      arquivoPdfUrl: true,
      setorId: true,
      maquinaId: true,
      programadorId: true,
      material: true,
      espessuraMm: true,
      larguraChapaMm: true,
      alturaChapaMm: true,
      pesoChapaKg: true,
      pesoPecasKg: true,
      pesoSobraKg: true,
      aproveitamentoPct: true,
      quantidadeChapas: true,
      numeroPiercings: true,
      comprimentoCorteMm: true,
      comprimentoRapidoMm: true,
      tempoCorteSegundos: true,
      tempoDeslocamentoSegundos: true,
      observacao: true,
      status: true,
      setor: { select: { id: true, nome: true } },
      itens: {
        select: {
          opId: true,
          pecaId: true,
          quantidadePlanejada: true,
          lancamentos: { select: { quantidadeBoa: true } },
        },
      },
    },
  });

  if (!origem) throw new Error("Nest não encontrado.");
  if (!["CONCLUIDO", "CANCELADO"].includes(origem.status)) {
    throw new Error("O nest só pode ser refeito depois de concluído ou cancelado.");
  }
  validarAcessoAoSetor(usuario, origem.setor);

  const itens = origem.itens
    .map((item) => ({
      opId: item.opId,
      pecaId: item.pecaId,
      quantidadePlanejada: refazerTudo
        ? item.quantidadePlanejada
        : Math.max(0, item.quantidadePlanejada - item.lancamentos.reduce((total, lancamento) => total + lancamento.quantidadeBoa, 0)),
    }))
    .filter((item) => item.quantidadePlanejada > 0);

  if (!itens.length) {
    throw new Error("Não há peças pendentes para refazer. Se quiser repetir tudo, escolha a refação total.");
  }

  const prefixo = `${origem.codigo.slice(0, 70).replace(/-+$/, "")}-R`;
  const codigosExistentes = await prisma.nestCorte.findMany({
    where: { codigo: { startsWith: prefixo } },
    select: { codigo: true },
  });
  const usados = new Set(codigosExistentes.map((item) => item.codigo));
  let sequencia = 1;
  let codigo = `${prefixo}${sequencia}`;
  while (usados.has(codigo)) {
    sequencia += 1;
    codigo = `${prefixo}${sequencia}`;
  }

  const agora = new Date();
  const novoNest = await prisma.nestCorte.create({
    data: {
      codigo,
      nomeArquivo: origem.nomeArquivo,
      arquivoPdfUrl: origem.arquivoPdfUrl,
      setorId: origem.setorId,
      maquinaId: origem.maquinaId,
      programadorId: usuario.id,
      material: origem.material,
      espessuraMm: origem.espessuraMm,
      larguraChapaMm: origem.larguraChapaMm,
      alturaChapaMm: origem.alturaChapaMm,
      pesoChapaKg: origem.pesoChapaKg,
      pesoPecasKg: origem.pesoPecasKg,
      pesoSobraKg: origem.pesoSobraKg,
      aproveitamentoPct: origem.aproveitamentoPct,
      quantidadeChapas: origem.quantidadeChapas,
      numeroPiercings: origem.numeroPiercings,
      comprimentoCorteMm: origem.comprimentoCorteMm,
      comprimentoRapidoMm: origem.comprimentoRapidoMm,
      tempoCorteSegundos: origem.tempoCorteSegundos,
      tempoDeslocamentoSegundos: origem.tempoDeslocamentoSegundos,
      refeitoDeId: origem.id,
      observacao: [
        `Refazendo o NEST ${origem.codigo}.`,
        refazerTudo ? "Refação total." : "Refação das peças pendentes.",
        motivo ? `Motivo: ${motivo}` : "Motivo não informado.",
      ].join(" "),
      itens: { create: itens },
    },
  });
  await prisma.nestEvento.create({
    data: {
      nestId: novoNest.id,
      funcionarioId: usuario.id,
      tipo: "PROGRAMADO",
      descricao: `NEST criado para refazer ${origem.codigo}.`,
      dataHora: agora,
    },
  });
  await registrarAlteracao({
    entidade: "NEST",
    entidadeId: novoNest.id,
    acao: "CRIADO",
    descricao: `NEST ${codigo} criado para refazer ${origem.codigo}.`,
    usuario: usuario.nome,
    dadosDepois: { refeitoDeId: origem.id, quantidade: refazerTudo ? "TOTAL" : "PENDENCIAS", itens: itens.length },
  });

  revalidarNests();
  revalidatePath(`/plasma/${novoNest.id}`);
}

export async function registrarEventoNest(formData: FormData) {
  const usuario = await exigirUsuarioLogado();
  const nestId = inteiro(formData.get("nestId"), "Nest", 1);
  const tipo = texto(formData.get("tipo"), 24).toUpperCase();
  if (!EVENTOS_NEST.includes(tipo as (typeof EVENTOS_NEST)[number])) {
    throw new Error("Evento de operação inválido.");
  }

  const nest = await prisma.nestCorte.findUnique({
    where: { id: nestId },
    select: {
      id: true,
      status: true,
      iniciadoEm: true,
      maquinaId: true,
      setor: { select: { id: true, nome: true } },
      itens: {
        select: {
          id: true,
          quantidadePlanejada: true,
          op: { select: { numeroSequencia: true, lote: true } },
          peca: { select: { codigo: true } },
          lancamentos: { select: { quantidadeBoa: true, quantidadeRefugo: true } },
        },
      },
    },
  });
  if (!nest) throw new Error("Nest não encontrado.");
  validarAcessoAoSetor(usuario, nest.setor);

  const transicoes: Record<(typeof EVENTOS_NEST)[number], StatusNest> = {
    INICIO: "EM_CORTE",
    PAUSA: "PAUSADO",
    RETORNO: "EM_CORTE",
    FIM: "CONCLUIDO",
    CANCELAMENTO: "CANCELADO",
  };
  const statusPermitidos: Record<(typeof EVENTOS_NEST)[number], string[]> = {
    INICIO: ["PROGRAMADO"],
    PAUSA: ["EM_CORTE"],
    RETORNO: ["PAUSADO"],
    FIM: ["EM_CORTE", "PAUSADO"],
    CANCELAMENTO: ["PROGRAMADO", "EM_CORTE", "PAUSADO"],
  };
  if (!statusPermitidos[tipo as (typeof EVENTOS_NEST)[number]].includes(nest.status)) {
    throw new Error("Este evento não é compatível com a situação atual do nest.");
  }
  const novoStatus = transicoes[tipo as (typeof EVENTOS_NEST)[number]];
  const agora = new Date();

  if (["INICIO", "RETORNO"].includes(tipo)) {
    const ocupante = await prisma.nestCorte.findFirst({
      where: { maquinaId: nest.maquinaId, id: { not: nest.id }, status: { in: ["EM_CORTE", "PAUSADO"] } },
      select: { codigo: true },
    });
    if (ocupante) throw new Error(`A máquina já está em uso pelo ${ocupante.codigo}.`);
  }
  const faltasAutomaticas: Array<{ itemId: number; quantidade: number; opNumero: number; lote: string | null; pecaCodigo: string }> = [];
  if (tipo === "FIM") {
    if (ehSetor(nest.setor.nome, "Plasma Chapa")) {
      for (const item of nest.itens) {
        const declarado = item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeBoa + lancamento.quantidadeRefugo, 0);
        const falta = Math.max(0, item.quantidadePlanejada - declarado);
        if (falta > 0) {
          faltasAutomaticas.push({
            itemId: item.id,
            quantidade: falta,
            opNumero: item.op.numeroSequencia,
            lote: item.op.lote,
            pecaCodigo: item.peca.codigo,
          });
        }
      }
    } else {
      const incompletos = nest.itens.filter((item) => {
        const total = item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeBoa + lancamento.quantidadeRefugo, 0);
        return total !== item.quantidadePlanejada;
      });
      if (incompletos.length) throw new Error("Informe boas e perdas de todas as peças antes de finalizar.");
    }
  }

  const descricao = texto(formData.get("descricao"), 500) || null;
  const operacoes: Prisma.PrismaPromise<unknown>[] = [];
  for (const falta of faltasAutomaticas) {
    operacoes.push(prisma.nestLancamento.create({
      data: {
        nestItemId: falta.itemId,
        funcionarioId: usuario.id,
        tipo: "PRODUCAO",
        quantidadeBoa: 0,
        quantidadeRefugo: falta.quantidade,
        motivoRefugo: "Falta apurada ao finalizar o corte",
        observacao: "Saldo não produzido enviado automaticamente para a reposição.",
        dataHora: agora,
      },
    }));
  }
  if (faltasAutomaticas.length > 0) {
    const resumo = faltasAutomaticas.map((falta) => `OP ${falta.opNumero}${falta.lote ? ` · lote ${falta.lote}` : ""} · ${falta.pecaCodigo}: ${falta.quantidade}`).join(" | ");
    operacoes.push(prisma.nestEvento.create({
      data: {
        nestId,
        funcionarioId: usuario.id,
        tipo: eventoReposicaoSolicitada(),
        descricao: `Falta do operador enviada para reposição ao finalizar o corte. ${resumo}`,
        dataHora: agora,
      },
    }));
  }
  operacoes.push(prisma.nestEvento.create({
    data: { nestId, funcionarioId: usuario.id, tipo, descricao, dataHora: agora },
  }));
  operacoes.push(prisma.nestCorte.update({
    where: { id: nestId },
    data: {
      status: novoStatus,
      iniciadoEm: tipo === "INICIO" ? (nest.iniciadoEm ?? agora) : undefined,
      finalizadoEm: ["FIM", "CANCELAMENTO"].includes(tipo) ? agora : undefined,
    },
  }));
  await prisma.$transaction(operacoes);
  await registrarAlteracao({ entidade: "NEST", entidadeId: nestId, acao: "ATUALIZADO", descricao: `Evento ${tipo} registrado no nest ${nestId}.`, usuario: usuario.nome, dadosDepois: { tipo, novoStatus, faltasEnviadas: faltasAutomaticas.reduce((soma, falta) => soma + falta.quantidade, 0) } });

  revalidarNests();
  revalidatePath(`/plasma/${nestId}`);
  revalidatePath(`/plasma/operar/${nestId}`);
  revalidatePath(`/plasma/apontar/${nestId}`);
  revalidatePath("/plasma/reposicao");
  revalidatePath("/plasma");
  return faltasAutomaticas.reduce((soma, falta) => soma + falta.quantidade, 0);
}

export async function registrarEventoNestSeguro(_anterior: ResultadoEventoNest | null, formData: FormData): Promise<ResultadoEventoNest> {
  try {
    const faltasEnviadas = await registrarEventoNest(formData);
    return { ok: true, tipo: texto(formData.get("tipo"), 24).toUpperCase(), faltasEnviadas };
  } catch (erro) {
    if (ehRedirecionamento(erro)) throw erro;
    return { ok: false, mensagem: mensagemDoErro(erro, "Não foi possível registrar o evento do NEST.") };
  }
}

export async function registrarLancamentoNest(formData: FormData) {
  const usuario = await exigirUsuarioLogado();
  const nestItemId = inteiro(formData.get("nestItemId"), "Item do nest", 1);
  const quantidadeBoa = inteiro(formData.get("quantidadeBoa"), "Quantidade boa");
  const quantidadeRefugo = inteiro(formData.get("quantidadeRefugo"), "Quantidade de perda");
  const tipo = texto(formData.get("tipo"), 24).toUpperCase();
  if (!(["PRODUCAO", "RETRABALHO"] as const).includes(tipo as "PRODUCAO" | "RETRABALHO")) {
    throw new Error("Tipo de lançamento inválido.");
  }
  if (!quantidadeBoa && !quantidadeRefugo) {
    throw new Error("Informe ao menos uma peça boa ou uma perda.");
  }

  const item = await prisma.nestItem.findUnique({
    where: { id: nestItemId },
    select: {
      id: true,
      opId: true,
      pecaId: true,
      quantidadePlanejada: true,
      lancamentos: { select: { quantidadeBoa: true, quantidadeRefugo: true } },
      nest: { select: { id: true, status: true, maquinaId: true, setorId: true, setor: { select: { id: true, nome: true } } } },
      peca: { select: { roteiro: { select: { id: true, setorId: true, processo: true } } } },
    },
  });
  if (!item) throw new Error("Item do nest não encontrado.");
  validarAcessoAoSetor(usuario, item.nest.setor);
  if (item.nest.status !== "EM_CORTE") {
    throw new Error("Inicie ou retome o nest antes de registrar as peças cortadas.");
  }

  const registrado = item.lancamentos.reduce((soma, l) => soma + l.quantidadeBoa + l.quantidadeRefugo, 0);
  if (registrado + quantidadeBoa + quantidadeRefugo > item.quantidadePlanejada) {
    throw new Error(`Restam ${Math.max(0, item.quantidadePlanejada - registrado)} peças a declarar neste NEST.`);
  }
  if (quantidadeRefugo && !texto(formData.get("motivoRefugo"), 300)) throw new Error("Informe o motivo da perda.");
  const agora = new Date();
  const operacoes: Prisma.PrismaPromise<unknown>[] = [prisma.nestLancamento.create({
    data: {
      nestItemId,
      funcionarioId: usuario.id,
      tipo,
      quantidadeBoa,
      quantidadeRefugo,
      motivoRefugo: texto(formData.get("motivoRefugo"), 300) || null,
      observacao: texto(formData.get("observacao"), 500) || null,
      dataHora: agora,
    },
  })];
  if (quantidadeRefugo > 0) {
    operacoes.push(prisma.nestEvento.create({
      data: {
        nestId: item.nest.id,
        funcionarioId: usuario.id,
        tipo: eventoReposicaoSolicitada(),
        descricao: `Perda do operador enviada para reposição: ${quantidadeRefugo} peça(s).`,
        dataHora: agora,
      },
    }));
  }
  await prisma.$transaction(operacoes);
  await registrarAlteracao({ entidade: "NEST", entidadeId: item.nest.id, acao: "ATUALIZADO", descricao: `Lançamento de corte registrado no nest ${item.nest.id}.`, usuario: usuario.nome, dadosDepois: { nestItemId, quantidadeBoa, quantidadeRefugo, tipo } });

  revalidarNests();
  revalidatePath(`/plasma/${item.nest.id}`);
  revalidatePath(`/plasma/operar/${item.nest.id}`);
  revalidatePath(`/plasma/apontar/${item.nest.id}`);
}

export async function registrarLancamentoNestSeguro(_anterior: ResultadoLancamentoNest | null, formData: FormData): Promise<ResultadoLancamentoNest> {
  try {
    await registrarLancamentoNest(formData);
    return { ok: true };
  } catch (erro) {
    if (ehRedirecionamento(erro)) throw erro;
    return { ok: false, mensagem: mensagemDoErro(erro, "Não foi possível salvar a produção.") };
  }
}

function podeProgramarReposicaoPlasma(usuario: OperadorLogado, setorId: number) {
  return Boolean(
    usuario.administrador ||
      usuario.papel === "PCP" ||
      (["LIDER", "OPERADOR"].includes(usuario.papel) && usuario.setorId === setorId),
  );
}

export async function reconhecerReposicaoPlasma(formData: FormData) {
  const usuario = await exigirUsuarioLogado();
  const eventoId = inteiro(formData.get("eventoId"), "Evento de reposição", 1);
  const setores = (await prisma.setor.findMany({ select: { id: true, nome: true } }))
    .filter((setor) => ehSetor(setor.nome, "Plasma Chapa"));
  const setor = setores[0];
  if (!setor || !podeProgramarReposicaoPlasma(usuario, setor.id)) return;

  const evento = await prisma.nestEvento.findFirst({
    where: { id: eventoId, tipo: eventoReposicaoSolicitada(), nest: { setorId: setor.id } },
    select: { id: true, nestId: true },
  });
  if (!evento) return;

  const aviso = await buscarAvisoReposicaoPlasma(setor.id);
  if (!aviso.ultimaSolicitacao || evento.id > aviso.ultimaSolicitacao.id || evento.id <= aviso.visualizadoAte) return;

  await prisma.nestEvento.create({
    data: {
      nestId: evento.nestId,
      funcionarioId: usuario.id,
      tipo: eventoReposicaoVisualizada(),
      descricao: `Fila de reposição visualizada até o evento ${evento.id}.`,
      dataHora: new Date(),
    },
  });
  revalidatePath("/plasma");
  revalidatePath("/plasma/reposicao");
}

export async function conferirLancamentoNest(formData: FormData) {
  const usuario = await exigirUsuarioLogado();
  const id = inteiro(formData.get("lancamentoId"), "Lançamento", 1);
  const registro = await prisma.nestLancamento.findUnique({
    where: { id }, include: { item: { include: { nest: { include: { setor: { select: { nome: true } } } } } } },
  });
  if (!registro) throw new Error("Lançamento não encontrado.");
  if (!setorEhPlasma(registro.item.nest.setor.nome) || !podeConferirPlasma(usuario)) throw new Error("Seu usuário não tem acesso à conferência do Plasma.");
  if (!usuario.administrador && registro.funcionarioId === usuario.id) throw new Error("Outro usuário deve conferir este lançamento.");
  if (registro.apontamentoId !== null) throw new Error("Este lançamento já foi conferido.");
  if (!["CONCLUIDO", "CANCELADO"].includes(registro.item.nest.status)) throw new Error("Aguarde o encerramento do corte.");
  const valorRecebido = formData.get("quantidadeRecebida") ?? formData.get("quantidadeConferidaBoa");
  const recebidas = inteiro(valorRecebido, "Total recebido");
  const totalDeclarado = registro.quantidadeBoa + registro.quantidadeRefugo;
  if (recebidas > totalDeclarado) throw new Error("O total recebido não pode superar o total declarado.");
  const faltaConferente = Math.max(0, registro.quantidadeBoa - recebidas);
  const acaoConferencia = texto(formData.get("acaoConferencia"), 32);
  const motivo = texto(formData.get("motivoConferencia"), 500);
  const roteiroEtapa = await prisma.pecaRoteiro.findFirst({
    where: { pecaId: registro.item.pecaId, setorId: registro.item.nest.setorId, processo: "CORTE" },
    orderBy: { ordem: "asc" },
    select: { id: true },
  });
  const apontamento = await prisma.apontamento.create({ data: {
    opId: registro.item.opId,
    setorId: registro.item.nest.setorId,
    funcionarioId: usuario.id,
    usuario: usuario.nome,
    quantidadeBoa: recebidas,
    quantidadeRefugo: totalDeclarado - recebidas,
    dataHora: new Date(),
    pecaId: registro.item.pecaId,
    processo: "CORTE",
    roteiroEtapaId: roteiroEtapa?.id ?? null,
    origem: "NEST_CONFERIDO",
    maquinaId: registro.item.nest.maquinaId,
  } });
  await prisma.nestLancamento.update({ where: { id }, data: {
    conferenteId: usuario.id, conferidoEm: new Date(), quantidadeConferidaBoa: recebidas,
    quantidadeConferidaRefugo: totalDeclarado - recebidas,
    motivoConferencia: motivo || null,
    apontamentoId: apontamento.id,
  } });
  await prisma.nestEvento.create({
    data: {
      nestId: registro.item.nestId,
      funcionarioId: usuario.id,
      tipo: "CONFERENCIA",
      descricao: `Lançamento ${id}: ${recebidas} recebidas / ${totalDeclarado - recebidas} perdas.${acaoConferencia === "falta" && faltaConferente > 0 ? ` Falta adicional do conferente: ${faltaConferente} peça(s) para reposição.` : ""}${acaoConferencia === "falta" && faltaConferente === 0 && registro.quantidadeRefugo > 0 ? " Conferente também notificou a falta já informada pelo operador; nenhuma reposição adicional foi criada." : ""}${motivo ? ` ${motivo}` : ""}`,
      dataHora: new Date(),
    },
  });
  if (totalDeclarado - recebidas > 0) {
    await prisma.nestEvento.create({
      data: {
        nestId: registro.item.nestId,
        funcionarioId: usuario.id,
        tipo: eventoReposicaoSolicitada(),
        descricao: `Falta confirmada pelo conferente: ${totalDeclarado - recebidas} peça(s). A ocorrência foi registrada na reposição.`,
        dataHora: new Date(),
      },
    });
  }
  revalidarNests();
  revalidatePath(`/plasma/${registro.item.nestId}`);
  revalidatePath("/plasma/conferencia");
  revalidatePath(`/plasma/conferencia/op/${registro.item.opId}`);
}

export async function conferirLancamentoNestSeguro(_anterior: ResultadoConferenciaNest | null, formData: FormData): Promise<ResultadoConferenciaNest> {
  try {
    await conferirLancamentoNest(formData);
    return { ok: true };
  } catch (erro) {
    if (ehRedirecionamento(erro)) throw erro;
    return { ok: false, mensagem: mensagemDoErro(erro, "Não foi possível confirmar o corte.") };
  }
}

/** Confere uma OP/peça inteira de uma vez, preservando cada lançamento por NEST. */
export async function conferirOpPlasma(formData: FormData) {
  const usuario = await exigirUsuarioLogado();
  if (!podeConferirPlasma(usuario)) throw new Error("Seu usuário não tem acesso à conferência do Plasma Chapa.");

  const opId = inteiro(formData.get("opId"), "OP", 1);
  const pecaId = inteiro(formData.get("pecaId"), "Peça", 1);
  const quantidadeRecebida = inteiro(formData.get("quantidadeRecebida"), "Total recebido");
  const motivo = texto(formData.get("motivoConferencia"), 500);
  const acaoConferencia = texto(formData.get("acaoConferencia"), 32);

  const [setores, op] = await Promise.all([
    prisma.setor.findMany({ select: { id: true, nome: true } }),
    prisma.oP.findUnique({
      where: { id: opId },
      select: {
        id: true,
        numeroSequencia: true,
        quantidade: true,
        modelo: {
          select: {
            pecas: {
              where: { pecaId },
              select: { quantidadeNecessaria: true, peca: { select: { codigo: true } } },
            },
          },
        },
      },
    }),
  ]);
    const setor = setores.find((item) => ehSetor(item.nome, "Plasma Chapa"));
    if (!setor || !op) throw new Error(!setor ? "Setor Plasma Chapa não encontrado." : "OP não encontrada.");

    const componente = op.modelo.pecas[0];
    if (!componente) throw new Error("A peça informada não pertence à OP.");

    const itens = await prisma.nestItem.findMany({
      where: { opId, pecaId, nest: { setorId: setor.id } },
      select: {
        id: true,
        nestId: true,
        nest: { select: { id: true, codigo: true, status: true, maquinaId: true } },
        lancamentos: {
          orderBy: [{ dataHora: "asc" }, { id: "asc" }],
          select: {
            id: true,
            funcionarioId: true,
            quantidadeBoa: true,
            quantidadeRefugo: true,
            apontamentoId: true,
            quantidadeConferidaBoa: true,
            quantidadeConferidaRefugo: true,
            dataHora: true,
          },
        },
      },
    });
    if (!itens.length) throw new Error("Não há NESTs cadastrados para esta OP e peça no Plasma Chapa.");
    if (!itens.every((item) => ["CONCLUIDO", "CANCELADO"].includes(item.nest.status))) {
      throw new Error("Aguarde o encerramento de todos os NESTs desta OP antes da conferência.");
    }

    const lancamentos = itens.flatMap((item) => item.lancamentos.map((lancamento) => ({
      ...lancamento,
      nestId: item.nestId,
      nestCodigo: item.nest.codigo,
      maquinaId: item.nest.maquinaId,
    }))).sort((a, b) => +a.dataHora - +b.dataHora || a.id - b.id);
    const pendentes = lancamentos.filter((lancamento) => lancamento.apontamentoId === null);
    if (!pendentes.length) throw new Error("Todos os lançamentos desta OP já foram conferidos.");
    if (!usuario.administrador && pendentes.some((lancamento) => lancamento.funcionarioId === usuario.id)) {
      throw new Error("Outro usuário deve conferir os lançamentos feitos pelo próprio conferente.");
    }

    const necessaria = op.quantidade * componente.quantidadeNecessaria;
    const totalDeclarado = lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeBoa + lancamento.quantidadeRefugo, 0);
    const totalPerdasOperador = lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeRefugo, 0);
    const totalLiberado = lancamentos.reduce((soma, lancamento) => soma + (lancamento.apontamentoId === null ? 0 : lancamento.quantidadeConferidaBoa ?? lancamento.quantidadeBoa), 0);
    const perdasJaConferidas = lancamentos.reduce((soma, lancamento) => soma + (lancamento.apontamentoId === null ? 0 : lancamento.quantidadeConferidaRefugo ?? lancamento.quantidadeRefugo), 0);

    if (quantidadeRecebida > necessaria) throw new Error(`O total recebido não pode superar a quantidade da OP (${necessaria}).`);
    if (quantidadeRecebida > totalDeclarado) throw new Error("O total recebido não pode superar o total declarado pelos operadores.");
    if (quantidadeRecebida < totalLiberado) throw new Error(`O total recebido não pode ser menor que o já liberado (${totalLiberado}).`);
    if (quantidadeRecebida + totalPerdasOperador > necessaria) throw new Error("Os lançamentos do operador e o total recebido não fecham com a quantidade da OP.");

    const faltaTotal = Math.max(0, necessaria - quantidadeRecebida);
    if (faltaTotal > 0 && acaoConferencia !== "falta") throw new Error("Use o botão de registrar falta para concluir uma conferência abaixo do total da OP.");
    if (faltaTotal === 0 && acaoConferencia === "falta") throw new Error("A OP está completa; use a confirmação do recebimento.");

    const boasAConfirmar = quantidadeRecebida - totalLiberado;
    const perdasAConfirmar = faltaTotal - perdasJaConferidas;
    if (perdasAConfirmar < 0) throw new Error("Os lançamentos já conferidos ultrapassam a falta calculada da OP.");

    let boasRestantes = boasAConfirmar;
    const alocacoes = pendentes.map((lancamento) => {
      const boas = Math.min(lancamento.quantidadeBoa, Math.max(0, boasRestantes));
      boasRestantes -= boas;
      return {
        lancamento,
        boas,
        perdaBase: Math.max(0, lancamento.quantidadeBoa - boas) + lancamento.quantidadeRefugo,
      };
    });
    if (boasRestantes > 0) throw new Error("O total recebido é maior que as peças disponíveis nos lançamentos pendentes.");

    const perdasBase = alocacoes.reduce((soma, alocacao) => soma + alocacao.perdaBase, 0);
    if (perdasAConfirmar < perdasBase) throw new Error("Não foi possível distribuir a conferência sem alterar lançamentos já confirmados.");
    const perdaExtra = perdasAConfirmar - perdasBase;
    const roteiroEtapa = await prisma.pecaRoteiro.findFirst({
      where: { pecaId, setorId: setor.id, processo: "CORTE" },
      orderBy: { ordem: "asc" },
      select: { id: true },
    });
    const agora = new Date();
    const faltaOperador = Math.min(totalPerdasOperador, faltaTotal);
    const faltaConferente = Math.max(0, faltaTotal - faltaOperador);
    const avisoFalta = faltaTotal > 0
      ? faltaConferente > 0
        ? `Falta adicional identificada pelo conferente: ${faltaConferente} peça(s).`
        : "Conferente também notificou a falta já informada pelo operador; nenhuma reposição adicional foi criada."
      : "Recebimento total da OP confirmado pelo conferente.";

    const operacoes = alocacoes.flatMap((alocacao, indice) => {
      const quantidadeRefugo = alocacao.perdaBase + (indice === alocacoes.length - 1 ? perdaExtra : 0);
      return [
        prisma.apontamento.create({
          data: {
          opId,
          setorId: setor.id,
          funcionarioId: usuario.id,
          usuario: usuario.nome,
          quantidadeBoa: alocacao.boas,
          quantidadeRefugo,
          dataHora: agora,
          pecaId,
          processo: "CORTE",
          roteiroEtapaId: roteiroEtapa?.id ?? null,
          origem: "NEST_CONFERIDO",
          maquinaId: alocacao.lancamento.maquinaId,
            lancamentoNest: { connect: { id: alocacao.lancamento.id } },
          },
        }),
        prisma.nestLancamento.update({
          where: { id: alocacao.lancamento.id },
          data: {
          conferenteId: usuario.id,
          conferidoEm: agora,
          quantidadeConferidaBoa: alocacao.boas,
          quantidadeConferidaRefugo: quantidadeRefugo,
          motivoConferencia: motivo || null,
          },
        }),
        prisma.nestEvento.create({
          data: {
          nestId: alocacao.lancamento.nestId,
          funcionarioId: usuario.id,
          tipo: "CONFERENCIA",
          descricao: `Conferência da OP ${op.numeroSequencia} · ${componente.peca.codigo}: ${alocacao.boas} recebidas / ${quantidadeRefugo} perdas. ${avisoFalta}${motivo ? ` ${motivo}` : ""}`,
          dataHora: agora,
          },
        }),
      ];
    });
    if (faltaTotal > 0) {
      operacoes.push(prisma.nestEvento.create({
        data: {
          nestId: pendentes[0].nestId,
          funcionarioId: usuario.id,
          tipo: eventoReposicaoSolicitada(),
          descricao: `Falta do conferente registrada para a OP ${op.numeroSequencia} · ${componente.peca.codigo}: ${faltaTotal} peça(s). ${avisoFalta}`,
          dataHora: agora,
        },
      }));
    }
    await prisma.$transaction(operacoes);

  const resumo = { nestId: pendentes[0].nestId, necessaria, quantidadeRecebida, faltaTotal };

  await registrarAlteracao({
    entidade: "NEST",
    entidadeId: resumo.nestId,
    acao: "ATUALIZADO",
    descricao: `Conferência consolidada da OP ${opId}, peça ${pecaId}: ${resumo.quantidadeRecebida}/${resumo.necessaria} recebidas.`,
    usuario: usuario.nome,
    dadosDepois: resumo,
  });
  revalidarNests();
  revalidatePath(`/plasma/conferencia/op/${opId}`);
  revalidatePath("/plasma/conferencia");
  revalidatePath("/plasma/reposicao");
}

export async function conferirOpPlasmaSeguro(_anterior: ResultadoConferenciaNest | null, formData: FormData): Promise<ResultadoConferenciaNest> {
  try {
    await conferirOpPlasma(formData);
    return { ok: true };
  } catch (erro) {
    if (ehRedirecionamento(erro)) throw erro;
    return { ok: false, mensagem: mensagemDoErro(erro, "Não foi possível confirmar o recebimento da OP.") };
  }
}

