import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient();

const SETORES = [
  { nome: "PCP", ordemPadrao: 1 },
  { nome: "Tubo", ordemPadrao: 2 },
  { nome: "Abastecimento", ordemPadrao: 3 },
  { nome: "Ponteira", ordemPadrao: 4 },
  { nome: "Plasma Chapa", ordemPadrao: 5 },
  { nome: "Plasma Tubo", ordemPadrao: 6 },
  { nome: "Componente", ordemPadrao: 7 },
  { nome: "Componente Reforço", ordemPadrao: 8 },
  { nome: "Solda", ordemPadrao: 9 },
  { nome: "Pintura", ordemPadrao: 10 },
  { nome: "Montagem", ordemPadrao: 11 },
];

// 5 funcionários por setor com nomes brasileiros aleatórios
const FUNCIONARIOS_POR_SETOR: Record<string, string[]> = {
  "PCP": ["Carlos Silva", "Fernanda Oliveira", "Ricardo Santos", "Mariana Costa", "Bruno Almeida"],
  "Tubo": ["João Pereira", "Ana Souza", "Pedro Lima", "Camila Ferreira", "Lucas Rodrigues"],
  "Abastecimento": ["Rafael Martins", "Juliana Araújo", "Diego Nascimento", "Patrícia Gomes", "Thiago Ribeiro"],
  "Ponteira": ["Marcos Barbosa", "Letícia Carvalho", "Felipe Moreira", "Vanessa Mendes", "Gustavo Correia"],
  "Plasma Chapa": ["Anderson Teixeira", "Cristina Dias", "Leandro Rocha", "Aline Cardoso", "Renato Nunes"],
  "Plasma Tubo": ["Roberto Vieira", "Simone Monteiro", "Fábio Castro", "Daniela Pinto", "Eduardo Lopes"],
  "Componente": ["Alexandre Freitas", "Bianca Ramos", "Henrique Azevedo", "Isabela Campos", "Mateus Duarte"],
  "Componente Reforço": ["Alexandre Freitas", "Bianca Ramos", "Henrique Azevedo", "Isabela Campos", "Mateus Duarte"],
  "Solda": ["Adriano Melo", "Tatiana Fonseca", "Marcelo Cruz", "Priscila Borges", "Vinícius Cunha"],
  "Pintura": ["Renan Moura", "Gabriela Machado", "Caio Rezende", "Natália Guimarães", "André Pires"],
  "Montagem": ["Rogério Sampaio", "Érica Cavalcanti", "Leonardo Xavier", "Sandra Nogueira", "Paulo Brito"],
};

async function main() {
  // Criar setores
  for (const setor of SETORES) {
    await prisma.setor.upsert({
      where: { nome: setor.nome },
      update: { ordemPadrao: setor.ordemPadrao },
      create: { nome: setor.nome, ordemPadrao: setor.ordemPadrao },
    });
  }

  const setoresCriados = await prisma.setor.findMany();
  console.log(`✅ ${setoresCriados.length} setores criados.`);

  // Criar funcionários
  let totalFuncionarios = 0;
  for (const setor of setoresCriados) {
    const nomes = FUNCIONARIOS_POR_SETOR[setor.nome];
    if (!nomes) continue;

    for (const nome of nomes) {
      await prisma.funcionario.upsert({
        where: {
          nome_setorId: { nome, setorId: setor.id },
        },
        update: {},
        create: {
          nome,
          setorId: setor.id,
          ativo: true,
        },
      });
      totalFuncionarios++;
    }
  }

  console.log(`✅ ${totalFuncionarios} funcionários criados.`);
  console.log("🎉 Banco populado com sucesso!");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
