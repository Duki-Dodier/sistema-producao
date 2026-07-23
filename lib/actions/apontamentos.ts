"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ehSetor } from "@/lib/setores";
import { processosDaPeca, PROCESSOS, type Processo } from "@/lib/processos";

const revalidarApontamentos = () => {
  revalidatePath("/apontamentos");
  revalidatePath("/abastecimento");
  revalidatePath("/");
  revalidatePath("/monitoramento");
};

export async function createApontamento(formData: FormData) {
  const opId = Number(formData.get("opId"));
  const setorId = Number(formData.get("setorId"));
  const pecaIdRaw = String(formData.get("pecaId") ?? "").trim();
  const pecaId = pecaIdRaw ? Number(pecaIdRaw) : null;
  const processoRaw = String(formData.get("processo") ?? "").trim();
  const processo = processoRaw ? (processoRaw as Processo) : null;
  const roteiroEtapaRaw = String(formData.get("roteiroEtapaId") ?? "").trim();
  const roteiroEtapaId = roteiroEtapaRaw ? Number(roteiroEtapaRaw) : null;
  const quantidadeBoa = Number(formData.get("quantidadeBoa") ?? 0);

  // Identidade: preferimos funcionário + PIN (kiosk). O caminho por texto
  // livre (`usuario`) segue aceito como legado p/ formulários do PCP.
  const funcionarioIdRaw = String(formData.get("funcionarioId") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  let usuario = String(formData.get("usuario") ?? "").trim();

  if (funcionarioIdRaw) {
    const funcionarioId = Number(funcionarioIdRaw);
    if (!Number.isInteger(funcionarioId)) throw new Error("Operador inválido.");
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: { nome: true, ativo: true, pin: true },
    });
    if (!funcionario || !funcionario.ativo) {
      throw new Error("Operador não encontrado ou inativo.");
    }
    if (funcionario.pin && funcionario.pin !== pin) {
      throw new Error("PIN incorreto.");
    }
    usuario = funcionario.nome;
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

  await prisma.$transaction(async (tx) => {
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
          usuario,
          quantidadeBoa,
          pecaId,
          processo,
          roteiroEtapaId,
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
        const [abastecido, jaSoldado] = await Promise.all([
          tx.apontamento.aggregate({
            where: { opId, setorId, soldador: { not: null } },
            _sum: { quantidadeBoa: true },
          }),
          tx.apontamento.aggregate({
            where: { opId, setorId, soldador: null },
            _sum: { quantidadeBoa: true },
          }),
        ]);
        const saldoAbastecido =
          (abastecido._sum.quantidadeBoa ?? 0) - (jaSoldado._sum.quantidadeBoa ?? 0);
        if (quantidadeBoa > saldoAbastecido) {
          throw new Error(`Quantidade maior que o saldo abastecido para Solda: ${saldoAbastecido}.`);
        }
      }
    }

    await tx.apontamento.create({
      data: { opId, setorId, usuario, quantidadeBoa, pecaId, processo, origem: "OPERADOR" },
    });
  });

  revalidarApontamentos();
}
