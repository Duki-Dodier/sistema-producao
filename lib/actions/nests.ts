"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuarioLogado, type OperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { salvarPdf } from "@/lib/upload";
import { registrarAlteracao } from "@/lib/auditoria";
import { buscarDemandaPlasma } from "@/lib/plasma-saldo";
import { podeConferirPlasma } from "@/lib/plasma-regras";

type StatusNest = "PROGRAMADO" | "EM_CORTE" | "PAUSADO" | "CONCLUIDO" | "CANCELADO";
const EVENTOS_NEST = ["INICIO", "PAUSA", "RETORNO", "FIM", "CANCELAMENTO"] as const;

function texto(valor: FormDataEntryValue | null, limite: number) {
  return String(valor ?? "").trim().slice(0, limite);
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
    select: { id: true, status: true, iniciadoEm: true, setor: { select: { id: true, nome: true } } },
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

  // A migração 0046 valida e aplica a transição junto ao evento, atomicamente.
  await prisma.nestEvento.create({
    data: { nestId, funcionarioId: usuario.id, tipo, descricao: texto(formData.get("descricao"), 500) || null, dataHora: agora },
  });
  await registrarAlteracao({ entidade: "NEST", entidadeId: nestId, acao: "ATUALIZADO", descricao: `Evento ${tipo} registrado no nest ${nestId}.`, usuario: usuario.nome, dadosDepois: { tipo, novoStatus } });

  revalidarNests();
  revalidatePath(`/plasma/${nestId}`);
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
  await prisma.nestLancamento.create({
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
  });
  await registrarAlteracao({ entidade: "NEST", entidadeId: item.nest.id, acao: "ATUALIZADO", descricao: `Lançamento de corte registrado no nest ${item.nest.id}.`, usuario: usuario.nome, dadosDepois: { nestItemId, quantidadeBoa, quantidadeRefugo, tipo } });

  revalidarNests();
  revalidatePath(`/plasma/${item.nest.id}`);
}

export async function conferirLancamentoNest(formData: FormData) {
  const usuario = await exigirUsuarioLogado();
  const id = inteiro(formData.get("lancamentoId"), "Lançamento", 1);
  const registro = await prisma.nestLancamento.findUnique({
    where: { id }, include: { item: { include: { nest: { include: { setor: { select: { nome: true } } } } } } },
  });
  if (!registro) throw new Error("Lançamento não encontrado.");
  if (!setorEhPlasma(registro.item.nest.setor.nome) || !podeConferirPlasma(usuario)) throw new Error("Seu usuário não tem acesso à conferência do Plasma.");
  if (registro.funcionarioId === usuario.id) throw new Error("Outro usuário deve conferir este lançamento.");
  if (registro.apontamentoId !== null) throw new Error("Este lançamento já foi conferido.");
  if (!["CONCLUIDO", "CANCELADO"].includes(registro.item.nest.status)) throw new Error("Aguarde o encerramento do corte.");
  const boas = inteiro(formData.get("quantidadeConferidaBoa"), "Boas conferidas");
  const totalDeclarado = registro.quantidadeBoa + registro.quantidadeRefugo;
  if (boas > totalDeclarado) throw new Error("As boas conferidas não podem superar o total declarado.");
  const motivo = texto(formData.get("motivoConferencia"), 500);
  if (boas !== registro.quantidadeBoa && !motivo) throw new Error("Informe o motivo da divergência.");
  await prisma.nestLancamento.update({ where: { id }, data: {
    conferenteId: usuario.id, conferidoEm: new Date(), quantidadeConferidaBoa: boas,
    quantidadeConferidaRefugo: totalDeclarado - boas,
    motivoConferencia: motivo || null,
  } });
  revalidarNests();
  revalidatePath(`/plasma/${registro.item.nestId}`);
}

