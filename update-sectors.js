const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SETORES_FINAL = [
  "Componente",
  "Tubo",
  "Ponteira",
  "Plasma Chapa",
  "Plasma Tubo",
  "Acessórios",
  "Agrupamento",
  "Solda",
  "Pintura",
  "Montagem"
];

async function wipeAndSeed() {
  console.log("Apagando dados de teste (OPs, Apontamentos, Modelos, Peças)...");
  await prisma.apontamento.deleteMany({});
  await prisma.oP.deleteMany({});
  await prisma.modeloRoteiro.deleteMany({});
  await prisma.modeloPeca.deleteMany({});
  await prisma.peca.deleteMany({});
  await prisma.modelo.deleteMany({});
  await prisma.setor.deleteMany({}); // Agora que está tudo vazio, podemos deletar os setores

  console.log("Inserindo os setores definitivos...");
  for (let i = 0; i < SETORES_FINAL.length; i++) {
    await prisma.setor.create({
      data: {
        nome: SETORES_FINAL[i],
        ordemPadrao: i + 1
      }
    });
  }

  console.log("Banco zerado e setores atualizados com sucesso!");
}

wipeAndSeed()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
