"use server";

import { prisma } from "@/lib/prisma";
import { refresh, revalidatePath } from "next/cache";
import { ehSetor } from "@/lib/setores";
import { processosDaPeca, PROCESSOS, type Processo } from "@/lib/processos";
import { exigirUsuarioLogado } from "@/lib/auth-operador";

const revalidarApontamentos = () => {
  revalidatePath("/apontamentos");
  revalidatePath("/agrupamento");
  revalidatePath("/");
  revalidatePath("/monitoramento");
};

function nomeComparavel(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

export type ResultadoApontamento =
  | { ok: true }
  | { ok: false; error: string };

export async function createApontamento(formData: FormData): Promise<ResultadoApontamento> {
  const usuarioAutenticado = await exigirUsuarioLogado();
  try {
  const opId = Number(formData.get("opId"));
  const setorId = Number(formData.get("setorId"));
  const pecaIdRaw = String(formData.get("pecaId") ?? "").trim();
  const pecaId = pecaIdRaw ? Number(pecaIdRaw) : null;
  const processoRaw = String(formData.get("processo") ?? "").trim();
  const processo = processoRaw ? (processoRaw as Processo) : null;
  const roteiroEtapaRaw = String(formData.get("roteiroEtapaId") ?? "").trim();
  const roteiroEtapaId = roteiroEtapaRaw ? Number(roteiroEtapaRaw) : null;
  const quantidadeBoa = Number(formData.get("quantidadeBoa") ?? 0);
  const maquinaIdRaw = String(formData.get("maquinaId") ?? "").trim();
  const maquinaId = maquinaIdRaw ? Number(maquinaIdRaw) : null;
  const tempoSegundosRaw = String(formData.get("tempoSegundos") ?? "").trim();
  const tempoMinutosRaw = String(formData.get("tempoMinutos") ?? "").trim();
  const tempoInformadoBruto = tempoSegundosRaw
    ? Number(tempoSegundosRaw)
    : tempoMinutosRaw
      ? Number(tempoMinutosRaw) * 60
      : null;
  const tempoInformado = tempoInformadoBruto === 0 ? null : tempoInformadoBruto;

  // Identidade: preferimos funcionário + PIN (kiosk). O caminho por texto
  // livre (`usuario`) segue aceito como legado p/ formulários do PCP.
  const funcionarioIdRaw = String(formData.get("funcionarioId") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  const usarSessao = String(formData.get("usarSessao") ?? "") === "1";
  const soldadorInformado = String(formData.get("soldador") ?? "").trim();
  let usuario = String(formData.get("usuario") ?? "").trim();
  let funcionarioIdRegistrado: number | null = null;

  if (usarSessao) {
    const sessao = usuarioAutenticado;
    if (sessao.papel !== "PCP" && sessao.setorId !== setorId) {
      throw new Error("Este funcionario so pode apontar no proprio setor.");
    }
    const processoPermitido = processo ?? "PRODUCAO";
    if (sessao.papel === "OPERADOR" && !sessao.processosPermitidos.includes(processoPermitido)) {
      throw new Error("Este operador nao esta autorizado para este processo.");
    }
    // PCP/admin pode operar a fila de qualquer soldador. O cartão da OP
    // informa para quem o Agrupamento enviou o lote; operadores comuns ficam
    // sempre limitados ao próprio nome da sessão.
    usuario = (sessao.papel === "PCP" || sessao.administrador) && soldadorInformado
      ? soldadorInformado
      : sessao.nome;
    funcionarioIdRegistrado = sessao.id;
  } else if (funcionarioIdRaw) {
    const funcionarioId = Number(funcionarioIdRaw);
    if (!Number.isInteger(funcionarioId)) throw new Error("Operador inválido.");
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: {
        nome: true,
        ativo: true,
        pin: true,
        papel: true,
        setorId: true,
        processosPermitidos: { select: { processo: true } },
      },
    });
    if (!funcionario || !funcionario.ativo) {
      throw new Error("Operador não encontrado ou inativo.");
    }
    const podeLancarEmNomeDeOutro = usuarioAutenticado.papel !== "OPERADOR" && usuario === funcionario.nome;
    if (funcionario.pin && funcionario.pin !== pin && !podeLancarEmNomeDeOutro) {
      throw new Error("PIN incorreto.");
    }
    if (funcionario.papel !== "PCP" && funcionario.setorId !== setorId) {
      throw new Error("Este funcionário só pode apontar no próprio setor.");
    }
    const processoPermitido = processo ?? "PRODUCAO";
    if (
      funcionario.papel === "OPERADOR" &&
      !funcionario.processosPermitidos.some((item) => item.processo === processoPermitido)
    ) {
      throw new Error("Este operador não está autorizado para este processo.");
    }
    usuario = funcionario.nome;
    funcionarioIdRegistrado = funcionarioId;
  }

  if (!Number.isInteger(opId) || !Number.isInteger(setorId) || !usuario) {
    throw new Error("Preencha OP, setor e o nome de quem esta lancando.");
  }
  if (!Number.isInteger(quantidadeBoa) || quantidadeBoa <= 0) {
    throw new Error("Informe uma quantidade inteira positiva.");
  }
  if (pecaId !== null && !Number.isInteger(pecaId)) {
    throw new Error("Peca invalida.");
  }
  if (roteiroEtapaId !== null && !Number.isInteger(roteiroEtapaId)) {
    throw new Error("Etapa do roteiro inválida.");
  }
  if (processo !== null && !PROCESSOS.includes(processo)) {
    throw new Error("Processo inválido.");
  }
  if (maquinaId !== null && !Number.isInteger(maquinaId)) {
    throw new Error("Máquina inválida.");
  }
  if (
    tempoInformado !== null &&
    (!Number.isFinite(tempoInformado) || !Number.isInteger(tempoInformado) || tempoInformado <= 0 || tempoInformado > 24 * 60 * 60)
  ) {
    throw new Error("O tempo de produção deve estar entre 1 segundo e 24 horas.");
  }

  const maquinasAtivas = await prisma.maquina.findMany({
    where: { setorId, ativo: true },
    select: { id: true },
  });
  if (maquinasAtivas.length > 0 && maquinaId === null) {
    throw new Error("Selecione a máquina usada neste apontamento.");
  }
  if (maquinaId !== null && !maquinasAtivas.some((maquina) => maquina.id === maquinaId)) {
    throw new Error("A máquina selecionada não pertence a este setor ou está inativa.");
  }

  const dadosRastreabilidade = () => {
    const dataHora = new Date();
    return {
      maquinaId,
      tempoSegundos: tempoInformado,
      inicioEm: tempoInformado !== null
        ? new Date(dataHora.getTime() - tempoInformado * 1000)
        : null,
      dataHora,
    };
  };

  // O adaptador Prisma do Cloudflare D1 não oferece transações interativas.
  // Este fluxo faz várias leituras de validação, mas somente uma gravação; por
  // isso, executamos as consultas diretamente e preservamos a mesma sequência.
  const registrarApontamento = async () => {
    const tx = prisma;
    const op = await tx.oP.findUnique({
      where: { id: opId },
      select: {
        status: true,
        quantidade: true,
        modelo: {
          select: {
            roteiro: { select: { setorId: true, setor: { select: { nome: true } } } },
            pecas: {
              select: {
                pecaId: true,
                quantidadeNecessaria: true,
                peca: {
                  select: {
                    setorId: true,
                    processos: true,
                    tipoMaterial: true,
                    setor: { select: { nome: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!op) throw new Error("OP nao encontrada.");
    if (op.status !== "ABERTA") throw new Error("So e possivel apontar uma OP aberta.");
    const etapa = op.modelo.roteiro.find((item) => item.setorId === setorId);
    if (!etapa && roteiroEtapaId === null) {
      throw new Error("O setor informado nao faz parte do roteiro desta OP.");
    }
    if (
      roteiroEtapaId === null &&
      etapa &&
      (ehSetor(etapa.setor.nome, "Pintura") || ehSetor(etapa.setor.nome, "Montagem"))
    ) {
      throw new Error("Use a página Pintura / Montagem para registrar esta etapa.");
    }

    const pecasDoSetor = op.modelo.pecas.filter((item) => item.peca.setorId === setorId);
    const etapaSolda = etapa ? ehSetor(etapa.setor.nome, "Solda") : false;

    if (roteiroEtapaId !== null) {
      if (pecaId === null) throw new Error("A etapa do roteiro precisa estar ligada a uma peça.");
      const pecaDaBom = op.modelo.pecas.find((item) => item.pecaId === pecaId);
      if (!pecaDaBom) throw new Error("A peça informada não pertence a esta OP.");

      const etapaPeca = await tx.pecaRoteiro.findUnique({
        where: { id: roteiroEtapaId },
        include: {
          peca: {
            select: {
              roteiro: {
                orderBy: { ordem: "asc" },
                select: { id: true, setorId: true, processo: true, ordem: true },
              },
            },
          },
        },
      });
      if (!etapaPeca || etapaPeca.pecaId !== pecaId || etapaPeca.setorId !== setorId) {
        throw new Error("Esta etapa não pertence à peça ou ao setor selecionado.");
      }
      if (processo !== etapaPeca.processo) {
        throw new Error("O processo informado não corresponde à próxima etapa da peça.");
      }

      const necessario = op.quantidade * pecaDaBom.quantidadeNecessaria;
      const totalEtapa = await tx.apontamento.aggregate({
        where: {
          opId,
          OR: [
            { roteiroEtapaId },
            {
              roteiroEtapaId: null,
              pecaId,
              setorId,
              processo: etapaPeca.processo,
            },
          ],
        },
        _sum: { quantidadeBoa: true },
      });
      const atual = totalEtapa._sum.quantidadeBoa ?? 0;
      if (atual + quantidadeBoa > necessario) {
        throw new Error(`Quantidade maior que o necessário para esta etapa: ${necessario}.`);
      }

      const indice = etapaPeca.peca.roteiro.findIndex((item) => item.id === roteiroEtapaId);
      if (indice > 0) {
        const anterior = etapaPeca.peca.roteiro[indice - 1];
        const totalAnterior = await tx.apontamento.aggregate({
          where: {
            opId,
            OR: [
              { roteiroEtapaId: anterior.id },
              {
                roteiroEtapaId: null,
                pecaId,
                setorId: anterior.setorId,
                processo: anterior.processo,
              },
            ],
          },
          _sum: { quantidadeBoa: true },
        });
        const liberado = totalAnterior._sum.quantidadeBoa ?? 0;
        if (atual + quantidadeBoa > liberado) {
          throw new Error(
            `A etapa anterior (${anterior.processo}) liberou somente ${liberado} peça(s).`,
          );
        }
      }

      await tx.apontamento.create({
        data: {
          opId,
          setorId,
          funcionarioId: funcionarioIdRegistrado,
          usuario,
          quantidadeBoa,
          pecaId,
          processo,
          roteiroEtapaId,
          ...dadosRastreabilidade(),
          origem: "OPERADOR",
        },
      });
      return;
    }

    const jaApontado = await tx.apontamento.aggregate({
      where: {
        opId,
        setorId,
        ...(pecaId === null ? { pecaId: null } : { pecaId }),
        ...(processo === null
          ? {}
          : { OR: [{ processo }, { processo: null }] }),
        ...(etapaSolda ? { soldador: null } : {}),
        // Na Solda, cada operador aponta somente o que foi abastecido para
        // ele. Nos demais setores o usuario continua sendo apenas o autor.
        ...(etapaSolda ? { usuario } : {}),
      },
      _sum: { quantidadeBoa: true },
    });
    const totalAtual = jaApontado._sum.quantidadeBoa ?? 0;

    if (pecaId !== null) {
      const pecaDaBom = pecasDoSetor.find((item) => item.pecaId === pecaId);
      if (!pecaDaBom) throw new Error("A peca informada nao pertence a este setor da OP.");
      const roteiro = processosDaPeca(pecaDaBom.peca);
      if (!processo || !roteiro.includes(processo)) {
        throw new Error("Selecione um processo válido para esta peça.");
      }
      const necessario = op.quantidade * pecaDaBom.quantidadeNecessaria;
      if (totalAtual + quantidadeBoa > necessario) {
        throw new Error(`Quantidade maior que o necessario para a peca: ${necessario}.`);
      }
      const indiceProcesso = roteiro.indexOf(processo);
      if (indiceProcesso > 0) {
        const processoAnterior = roteiro[indiceProcesso - 1];
        const disponivelAnterior = await tx.apontamento.aggregate({
          where: {
            opId,
            setorId,
            pecaId,
            OR: [{ processo: processoAnterior }, { processo: null }],
          },
          _sum: { quantidadeBoa: true },
        });
        const limite = disponivelAnterior._sum.quantidadeBoa ?? 0;
        if (totalAtual + quantidadeBoa > limite) {
          throw new Error(
            `O processo anterior (${processoAnterior}) liberou somente ${limite} peça(s).`,
          );
        }
      }
    } else {
      if (pecasDoSetor.length > 0) throw new Error("Selecione a peca produzida para este setor.");
      if (totalAtual + quantidadeBoa > op.quantidade) {
        throw new Error(`Quantidade maior que o total da OP: ${op.quantidade}.`);
      }
      if (etapaSolda) {
        // O nome pode ter diferenca de acento/caixa entre o envio do
        // Agrupamento e a sessao do operador. Comparamos de forma estavel.
        const registrosSolda = await tx.apontamento.findMany({
          where: { opId, setorId },
          select: { soldador: true, usuario: true, quantidadeBoa: true },
        });
        const nomeOperador = nomeComparavel(usuario);
        const abastecido = registrosSolda
          .filter((registro) => registro.soldador && nomeComparavel(registro.soldador) === nomeOperador)
          .reduce((total, registro) => total + registro.quantidadeBoa, 0);
        const jaSoldado = registrosSolda
          .filter((registro) => !registro.soldador && nomeComparavel(registro.usuario) === nomeOperador)
          .reduce((total, registro) => total + registro.quantidadeBoa, 0);
        const saldoAbastecido = abastecido - jaSoldado;
        if (quantidadeBoa > saldoAbastecido) {
          throw new Error(
            saldoAbastecido > 0
              ? `Quantidade maior que o saldo abastecido para Solda: ${saldoAbastecido}.`
              : "Esta OP nao possui saldo enviado para este soldador. Escolha uma OP destinada a ele.",
          );
        }
      }
    }

    await tx.apontamento.create({
      data: {
        opId,
        setorId,
        funcionarioId: funcionarioIdRegistrado,
        usuario,
        quantidadeBoa,
        pecaId,
        processo,
        ...dadosRastreabilidade(),
        origem: "OPERADOR",
      },
    });
  };

  await registrarApontamento();

  revalidarApontamentos();
  refresh();
  return { ok: true };
  } catch (error) {
    console.error("Falha ao registrar apontamento", error);
    return {
      ok: false,
      error: error instanceof Error && error.message
        ? error.message
        : "Nao foi possivel registrar o apontamento. Tente novamente.",
    };
  }
}

/** Adaptador para formulários server-side que não consomem o retorno estruturado. */
export async function createApontamentoForm(formData: FormData): Promise<void> {
  const resultado = await createApontamento(formData);
  if (!resultado.ok) throw new Error(resultado.error);
}
