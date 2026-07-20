import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const fluxo = [
  "TUBO",
  "PLASMA TUBO",
  "PLASMA CHAPA",
  "COMPONENTES E ACESSÓRIOS",
  "PONTEIRA",
  "AGRUPAMENTO",
  "SOLDA",
  "PINTURA",
  "MONTAGEM",
];

const normalizar = (nome: string) =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

const nomesPorSetor: Record<string, string[]> = {
  TUBO: ["CARLOS", "JOAO", "MARCOS", "RAFAEL"],
  "PLASMA TUBO": ["ALAN", "BRUNO", "DIEGO", "EVANDRO"],
  "PLASMA CHAPA": ["CAIO", "FABIO", "GILBERTO", "LEANDRO"],
  "COMPONENTES E ACESSÓRIOS": ["ANDRE", "CLEBER", "DOUGLAS", "RENATO"],
  PONTEIRA: ["ALEX", "EDUARDO", "HUGO", "RODRIGO"],
  AGRUPAMENTO: ["ANA", "BRUNA", "LUCAS", "PAULO"],
  SOLDA: ["TIAGO A", "PEDRO", "ANTONIO", "MARIO"],
  PINTURA: ["DANIEL", "ELIAS", "MAURICIO", "WESLEY"],
  MONTAGEM: ["FELIPE", "GUSTAVO", "RICARDO", "VINICIUS"],
};

type PecaDemo = {
  codigo: string;
  nome: string;
  setor: string;
  tipoMaterial: string;
  quantidade: number;
};

type ModeloDemo = {
  codigo: string;
  nome: string;
  curva: string;
  tipo: string;
  quantidadeOP: number;
  sequencia: number;
  roteiro: string[];
  pecas: PecaDemo[];
};

const modelos: ModeloDemo[] = [
  {
    codigo: "DEMO-A-100",
    nome: "Engate demonstração completo",
    curva: "A",
    tipo: "FIXO",
    quantidadeOP: 30,
    sequencia: 10,
    roteiro: ["TUBO", "PLASMA CHAPA", "COMPONENTES E ACESSÓRIOS", "PONTEIRA", "AGRUPAMENTO", "SOLDA", "PINTURA", "MONTAGEM"],
    pecas: [
      { codigo: "DA100-TB", nome: "Tubo principal 50x50", setor: "TUBO", tipoMaterial: "TUBO", quantidade: 1 },
      { codigo: "DA100-PC", nome: "Chapa lateral 6mm", setor: "PLASMA CHAPA", tipoMaterial: "CHAPA", quantidade: 2 },
      { codigo: "DA100-AC", nome: "Kit de acessórios", setor: "COMPONENTES E ACESSÓRIOS", tipoMaterial: "OUTRO", quantidade: 1 },
      { codigo: "DA100-PT", nome: "Ponteira padrão", setor: "PONTEIRA", tipoMaterial: "PONTEIRA", quantidade: 1 },
    ],
  },
  {
    codigo: "DEMO-B-200",
    nome: "Engate removível em produção",
    curva: "B",
    tipo: "REMOVIVEL",
    quantidadeOP: 20,
    sequencia: 20,
    roteiro: ["PLASMA TUBO", "COMPONENTES E ACESSÓRIOS", "PONTEIRA", "AGRUPAMENTO", "SOLDA", "PINTURA", "MONTAGEM"],
    pecas: [
      { codigo: "DB200-PTB", nome: "Tubo recortado", setor: "PLASMA TUBO", tipoMaterial: "TUBO", quantidade: 1 },
      { codigo: "DB200-AC", nome: "Kit removível", setor: "COMPONENTES E ACESSÓRIOS", tipoMaterial: "OUTRO", quantidade: 1 },
      { codigo: "DB200-PT", nome: "Ponteira removível", setor: "PONTEIRA", tipoMaterial: "PONTEIRA", quantidade: 1 },
    ],
  },
  {
    codigo: "DEMO-C-300",
    nome: "Engate aguardando fabricação",
    curva: "C",
    tipo: "FIXO",
    quantidadeOP: 15,
    sequencia: 30,
    roteiro: ["TUBO", "PLASMA CHAPA", "AGRUPAMENTO", "SOLDA", "PINTURA", "MONTAGEM"],
    pecas: [
      { codigo: "DC300-TB", nome: "Tubo estrutural", setor: "TUBO", tipoMaterial: "TUBO", quantidade: 1 },
      { codigo: "DC300-PC", nome: "Chapa de reforço", setor: "PLASMA CHAPA", tipoMaterial: "CHAPA", quantidade: 1 },
    ],
  },
];

async function main() {
  const atuais = await prisma.setor.findMany();
  const porNome = new Map(atuais.map((setor) => [normalizar(setor.nome), setor]));

  for (let ordem = 0; ordem < fluxo.length; ordem++) {
    const nome = fluxo[ordem];
    const existente = porNome.get(nome);
    const setor = existente
      ? await prisma.setor.update({
          where: { id: existente.id },
          data: { ordemPadrao: ordem + 1, metaMensal: 600 + ordem * 100, diasUteisMes: 22 },
        })
      : await prisma.setor.create({
          data: { nome, ordemPadrao: ordem + 1, metaMensal: 600 + ordem * 100, diasUteisMes: 22 },
        });
    porNome.set(nome, setor);

    const ativos = await prisma.funcionario.findMany({ where: { setorId: setor.id, ativo: true } });
    const nomesAtivos = new Set(ativos.map((funcionario) => normalizar(funcionario.nome)));
    for (const nomeFuncionario of nomesPorSetor[nome]) {
      if (nomesAtivos.size >= 4) break;
      if (nomesAtivos.has(normalizar(nomeFuncionario))) continue;
      await prisma.funcionario.create({ data: { nome: nomeFuncionario, setorId: setor.id } });
      nomesAtivos.add(normalizar(nomeFuncionario));
    }
    const lider = (await prisma.funcionario.findFirst({ where: { setorId: setor.id, ativo: true }, orderBy: { id: "asc" } }))?.nome;
    await prisma.setor.update({ where: { id: setor.id }, data: { lider: lider ?? null } });
  }

  const codigosDemo = modelos.map((modelo) => modelo.codigo);
  await prisma.oP.deleteMany({ where: { modelo: { codigo: { in: codigosDemo } } } });

  const opsCriadas: { codigo: string; opId: number; quantidade: number; pecas: Map<string, { id: number; quantidade: number; setorId: number }> }[] = [];
  for (const demo of modelos) {
    const modelo = await prisma.modelo.upsert({
      where: { codigo: demo.codigo },
      update: { nome: demo.nome, curva: demo.curva, tipo: demo.tipo },
      create: { codigo: demo.codigo, nome: demo.nome, curva: demo.curva, tipo: demo.tipo, estoqueMinimo: 5 },
    });
    await prisma.modeloRoteiro.deleteMany({ where: { modeloId: modelo.id } });
    await prisma.modeloPeca.deleteMany({ where: { modeloId: modelo.id } });
    await prisma.modeloRoteiro.createMany({
      data: demo.roteiro.map((nome, index) => ({ modeloId: modelo.id, setorId: porNome.get(nome)!.id, ordem: index + 1 })),
    });

    const pecas = new Map<string, { id: number; quantidade: number; setorId: number }>();
    for (const item of demo.pecas) {
      const setorId = porNome.get(item.setor)!.id;
      const peca = await prisma.peca.upsert({
        where: { codigo: item.codigo },
        update: { nome: item.nome, setorId, tipoMaterial: item.tipoMaterial },
        create: { codigo: item.codigo, nome: item.nome, setorId, tipoMaterial: item.tipoMaterial },
      });
      await prisma.modeloPeca.create({ data: { modeloId: modelo.id, pecaId: peca.id, quantidadeNecessaria: item.quantidade } });
      pecas.set(item.codigo, { id: peca.id, quantidade: item.quantidade, setorId });
    }

    const op = await prisma.oP.create({
      data: { numeroSequencia: demo.sequencia, modeloId: modelo.id, quantidade: demo.quantidadeOP },
    });
    opsCriadas.push({ codigo: demo.codigo, opId: op.id, quantidade: demo.quantidadeOP, pecas });
  }

  const opA = opsCriadas.find((op) => op.codigo === "DEMO-A-100")!;
  for (const peca of opA.pecas.values()) {
    const operador = await prisma.funcionario.findFirst({ where: { setorId: peca.setorId, ativo: true }, orderBy: { id: "asc" } });
    await prisma.apontamento.create({
      data: { opId: opA.opId, setorId: peca.setorId, pecaId: peca.id, usuario: operador!.nome, quantidadeBoa: opA.quantidade * peca.quantidade },
    });
  }
  const solda = porNome.get("SOLDA")!;
  const pintura = porNome.get("PINTURA")!;
  const montagem = porNome.get("MONTAGEM")!;
  const soldador = (await prisma.funcionario.findFirst({ where: { setorId: solda.id, ativo: true }, orderBy: { id: "asc" } }))!.nome;
  await prisma.apontamento.create({ data: { opId: opA.opId, setorId: solda.id, usuario: soldador, soldador, bancada: "BOX 01", abastecedor: "LUCAS", quantidadeBoa: 30 } });
  await prisma.apontamento.create({ data: { opId: opA.opId, setorId: solda.id, usuario: soldador, quantidadeBoa: 18 } });
  await prisma.apontamento.create({ data: { opId: opA.opId, setorId: pintura.id, usuario: nomesPorSetor.PINTURA[0], quantidadeBoa: 10 } });
  await prisma.apontamento.create({ data: { opId: opA.opId, setorId: montagem.id, usuario: nomesPorSetor.MONTAGEM[0], quantidadeBoa: 5 } });

  const opB = opsCriadas.find((op) => op.codigo === "DEMO-B-200")!;
  for (const peca of opB.pecas.values()) {
    const operador = await prisma.funcionario.findFirst({ where: { setorId: peca.setorId, ativo: true }, orderBy: { id: "asc" } });
    await prisma.apontamento.create({
      data: { opId: opB.opId, setorId: peca.setorId, pecaId: peca.id, usuario: operador!.nome, quantidadeBoa: 8 },
    });
  }

  console.log("Demo criada: 9 setores, 4 funcionários ativos por setor, 3 modelos e 3 OPs.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
