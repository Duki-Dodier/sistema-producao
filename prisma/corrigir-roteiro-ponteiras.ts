import { prisma } from "../lib/prisma";

type EtapaDesejada = { setorId: number; processo: string };

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
}

async function executar() {
  const setores = await prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } });
  const plasmaTubo = setores.find((setor) => normalizar(setor.nome) === "PLASMA TUBO");
  const ponteira = setores.find((setor) => normalizar(setor.nome) === "PONTEIRA");
  const abastecimento = setores.find((setor) => normalizar(setor.nome) === "ABASTECIMENTO");

  if (!plasmaTubo || !ponteira || !abastecimento) {
    throw new Error("Setores Plasma Tubo, Ponteira e Abastecimento precisam estar cadastrados.");
  }

  const candidatas = await prisma.peca.findMany({
    where: { tipoMaterial: "PONTEIRA" },
    include: {
      roteiro: { orderBy: { ordem: "asc" } },
      modelos: { select: { modeloId: true } },
    },
  });

  const removiveis = candidatas.filter((peca) => {
    const nome = normalizar(peca.nome);
    return nome.includes("PONTEIRA REM") || nome.includes("CABECA REMOVIVEL");
  });
  const fixas = candidatas.filter((peca) => {
    const nome = normalizar(peca.nome);
    return nome.includes("PONTEIRA FIXA") || Math.abs((peca.espessuraMm ?? 0) - 4.75) < 0.01;
  });

  const modelosAfetados = new Set<number>();

  await prisma.$transaction(async (tx) => {
    const sincronizar = async (
      peca: (typeof candidatas)[number],
      etapas: EtapaDesejada[],
      setorPrincipalId: number,
    ) => {
      if (peca.roteiro.length > etapas.length) {
        throw new Error(`A peça ${peca.codigo} possui mais etapas do que o roteiro corrigido.`);
      }

      await tx.pecaRoteiro.updateMany({
        where: { pecaId: peca.id },
        data: { ordem: { increment: 100 } },
      });

      for (const [indice, etapa] of etapas.entries()) {
        const existente = peca.roteiro[indice];
        if (existente) {
          await tx.pecaRoteiro.update({
            where: { id: existente.id },
            data: { ...etapa, ordem: indice + 1 },
          });
        } else {
          await tx.pecaRoteiro.create({
            data: { pecaId: peca.id, ...etapa, ordem: indice + 1 },
          });
        }
      }

      await tx.peca.update({
        where: { id: peca.id },
        data: {
          setorId: setorPrincipalId,
          processos: etapas
            .filter((etapa) => etapa.setorId === setorPrincipalId && etapa.processo !== "AGRUPAR")
            .map((etapa) => etapa.processo)
            .join(","),
        },
      });

      const primeiraEtapa = peca.roteiro[0];
      if (primeiraEtapa) {
        await tx.apontamento.updateMany({
          where: {
            pecaId: peca.id,
            processo: "CORTE",
            OR: [
              { roteiroEtapaId: primeiraEtapa.id },
              { roteiroEtapaId: null, setorId: peca.setorId },
            ],
          },
          data: { setorId: setorPrincipalId },
        });
      }

      for (const modelo of peca.modelos) modelosAfetados.add(modelo.modeloId);
    };

    for (const peca of removiveis) {
      await sincronizar(
        peca,
        [
          { setorId: plasmaTubo.id, processo: "CORTE" },
          { setorId: ponteira.id, processo: "LIXAR" },
          { setorId: ponteira.id, processo: "SOLDAGEM" },
          { setorId: abastecimento.id, processo: "AGRUPAR" },
        ],
        plasmaTubo.id,
      );
    }

    for (const peca of fixas) {
      await sincronizar(
        peca,
        [
          { setorId: ponteira.id, processo: "CORTE" },
          { setorId: ponteira.id, processo: "BATIDA" },
          { setorId: ponteira.id, processo: "LIXAR" },
          { setorId: ponteira.id, processo: "SOLDAGEM" },
          { setorId: abastecimento.id, processo: "AGRUPAR" },
        ],
        ponteira.id,
      );
    }

    for (const modeloId of modelosAfetados) {
      const roteiro = await tx.modeloRoteiro.findMany({
        where: { modeloId },
        include: { setor: true },
      });
      if (!roteiro.some((etapa) => etapa.setorId === plasmaTubo.id)) {
        await tx.modeloRoteiro.updateMany({
          where: { modeloId },
          data: { ordem: { increment: 100 } },
        });
        const setoresDoModelo = [...roteiro.map((etapa) => etapa.setor), plasmaTubo]
          .sort((a, b) => a.ordemPadrao - b.ordemPadrao);
        for (const [indice, setor] of setoresDoModelo.entries()) {
          const existente = roteiro.find((etapa) => etapa.setorId === setor.id);
          if (existente) {
            await tx.modeloRoteiro.update({
              where: { id: existente.id },
              data: { ordem: indice + 1 },
            });
          } else {
            await tx.modeloRoteiro.create({
              data: { modeloId, setorId: setor.id, ordem: indice + 1 },
            });
          }
        }
      }
    }
  });

  console.log(
    `Roteiros corrigidos: ${removiveis.length} ponteira(s) removível(is), ${fixas.length} ponteira(s) fixa(s), ${modelosAfetados.size} modelo(s).`,
  );
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
