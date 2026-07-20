import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Os setores do fluxo de produção, na ordem típica.
const SETORES = [
  "Tubo",
  "Plasma Tubo",
  "Plasma Chapa",
  "Ponteira",
  "Componentes e Acessórios",
  "Agrupamento",
  "Solda",
  "Pintura",
  "Montagem",
];

// Modelos de exemplo: cada um lista os setores do seu roteiro, na ordem.
// (Serve só para o painel do PCP ter dados de teste; pode apagar depois.)
const MODELOS = [
  {
    codigo: "ENG-FIXO-01",
    curva: "A",
    tipo: "FIXO",
    tamanhoPonteira: null,
    roteiro: [
      "Tubo",
      "Componentes e Acessórios",
      "Ponteira",
      "Agrupamento",
      "Solda",
      "Pintura",
      "Montagem",
    ],
  },
  {
    codigo: "ENG-REM-01",
    curva: "B",
    tipo: "REMOVIVEL",
    tamanhoPonteira: "P",
    roteiro: [
      "Plasma Tubo",
      "Ponteira",
      "Agrupamento",
      "Solda",
      "Pintura",
      "Montagem",
    ],
  },
];

// OPs de exemplo (numeroSequencia = prioridade de liberação).
const OPS = [
  { numeroSequencia: 3, modeloCodigo: "ENG-FIXO-01", quantidade: 40 },
  { numeroSequencia: 5, modeloCodigo: "ENG-REM-01", quantidade: 25 },
];

async function main() {
  // 1) Setores
  for (let i = 0; i < SETORES.length; i++) {
    const nome = SETORES[i];
    await prisma.setor.upsert({
      where: { nome },
      update: { ordemPadrao: i + 1 },
      create: { nome, ordemPadrao: i + 1 },
    });
  }
  const setores = await prisma.setor.findMany();
  const setorId = (nome: string) => {
    const s = setores.find((x) => x.nome === nome);
    if (!s) throw new Error(`Setor não encontrado no seed: ${nome}`);
    return s.id;
  };

  // 2) Modelos + roteiros
  for (const m of MODELOS) {
    const modelo = await prisma.modelo.upsert({
      where: { codigo: m.codigo },
      update: { curva: m.curva, tipo: m.tipo, tamanhoPonteira: m.tamanhoPonteira },
      create: {
        codigo: m.codigo,
        curva: m.curva,
        tipo: m.tipo,
        tamanhoPonteira: m.tamanhoPonteira,
      },
    });
    // Recria o roteiro do modelo do zero (idempotente).
    await prisma.modeloRoteiro.deleteMany({ where: { modeloId: modelo.id } });
    await prisma.modeloRoteiro.createMany({
      data: m.roteiro.map((nome, idx) => ({
        modeloId: modelo.id,
        setorId: setorId(nome),
        ordem: idx + 1,
      })),
    });
  }

  // 3) OPs de exemplo (só cria se ainda não existir uma com o mesmo número).
  for (const op of OPS) {
    const modelo = await prisma.modelo.findUnique({
      where: { codigo: op.modeloCodigo },
    });
    if (!modelo) continue;
    const existente = await prisma.oP.findFirst({
      where: { numeroSequencia: op.numeroSequencia },
    });
    if (!existente) {
      await prisma.oP.create({
        data: {
          numeroSequencia: op.numeroSequencia,
          modeloId: modelo.id,
          quantidade: op.quantidade,
        },
      });
    }
  }

  console.log(
    `Seed concluído: ${SETORES.length} setores, ${MODELOS.length} modelos, ${OPS.length} OPs de exemplo.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
