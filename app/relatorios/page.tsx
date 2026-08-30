import { PageHeader } from "@/components/page-header";
import {
  RelatoriosProducao,
  type ProcessoAtivoRelatorio,
  type ProdutoRelatorio,
  type RegistroRelatorio,
  type ModeloEngateRelatorio,
  type CapacidadeSetorRelatorio,
} from "@/components/relatorios-producao";
import { prisma } from "@/lib/prisma";

export default async function RelatoriosPage() {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const [registros, produtos, processosAtivos, modelos, setores, apontamentosHoje] = await Promise.all([
    prisma.apontamento.findMany({
      where: { tempoSegundos: { not: null } },
      orderBy: { dataHora: "desc" },
      take: 5000,
      select: {
        id: true,
        opId: true,
        dataHora: true,
        processo: true,
        usuario: true,
        quantidadeBoa: true,
        tempoSegundos: true,
        origem: true,
        setor: { select: { nome: true } },
        maquina: { select: { codigo: true } },
        peca: { select: { codigo: true, nome: true } },
        op: {
          select: {
            numeroSequencia: true,
            lote: true,
            modelo: { select: { codigo: true, nome: true } },
          },
        },
      },
    }),
    prisma.oP.findMany({
      where: { apontamentos: { some: { tempoSegundos: { not: null } } } },
      orderBy: { dataLiberacao: "desc" },
      take: 500,
      select: {
        id: true,
        numeroSequencia: true,
        lote: true,
        quantidade: true,
        status: true,
        dataLiberacao: true,
        dataFinalizacao: true,
        modelo: { select: { codigo: true, nome: true } },
      },
    }),
    prisma.producaoEmAndamento.findMany({
      orderBy: { iniciadoEm: "asc" },
      select: {
        id: true,
        iniciadoEm: true,
        quantidadePrevista: true,
        usuario: true,
        maquina: { select: { codigo: true } },
        setor: { select: { nome: true } },
        peca: { select: { nome: true } },
        op: { select: { numeroSequencia: true, modelo: { select: { codigo: true } } } },
      },
    }),
    prisma.modelo.findMany({
      orderBy: { codigo: "asc" },
      select: {
        id: true,
        codigo: true,
        nome: true,
        curva: true,
        tipo: true,
        tamanhoPonteira: true,
        estoqueMinimo: true,
        linhaProduto: true,
      },
    }),
    prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" }, select: { nome: true, metaMensal: true, mediaDiariaMeta: true, diasUteisMes: true } }),
    prisma.apontamento.findMany({
      where: { dataHora: { gte: inicioHoje } },
      select: { quantidadeBoa: true, tempoSegundos: true, setor: { select: { nome: true } }, maquina: { select: { codigo: true } } },
    }),
  ]);

  const capacidadeSetores: CapacidadeSetorRelatorio[] = setores.map((setor) => {
    const ativos = processosAtivos.filter((item) => item.setor.nome === setor.nome);
    const producao = apontamentosHoje.filter((item) => item.setor.nome === setor.nome);
    const maquinas = new Map<string, number>();
    for (const item of producao) if (item.maquina?.codigo) maquinas.set(item.maquina.codigo, (maquinas.get(item.maquina.codigo) ?? 0) + 1);
    const maquinaMaisUsada = [...maquinas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const tempos = producao.map((item) => item.tempoSegundos).filter((item): item is number => item !== null);
    const capacidadeEstimada = setor.mediaDiariaMeta ?? (setor.metaMensal && (setor.diasUteisMes ?? 22) > 0 ? setor.metaMensal / (setor.diasUteisMes ?? 22) : null);
    return {
      setorNome: setor.nome,
      fila: ativos.reduce((total, item) => total + (item.quantidadePrevista ?? 1), 0),
      produzidaHoje: producao.reduce((total, item) => total + item.quantidadeBoa, 0),
      tempoMedioSegundos: tempos.length ? tempos.reduce((total, item) => total + item, 0) / tempos.length : null,
      capacidadeEstimada,
      gargalo: ativos.length > 0 ? "Fila em andamento" : "Normal",
      maquinaMaisUsada,
    };
  });

  const registrosRelatorio: RegistroRelatorio[] = registros.map((registro) => ({
    id: registro.id,
    opId: registro.opId,
    opNumero: registro.op.numeroSequencia,
    lote: registro.op.lote,
    modeloCodigo: registro.op.modelo.codigo,
    modeloNome: registro.op.modelo.nome,
    pecaCodigo: registro.peca?.codigo ?? null,
    pecaNome: registro.peca?.nome ?? null,
    setorNome: registro.setor.nome,
    processo: registro.processo,
    usuario: registro.usuario,
    maquinaCodigo: registro.maquina?.codigo ?? null,
    quantidadeBoa: registro.quantidadeBoa,
    tempoSegundos: registro.tempoSegundos,
    dataHora: registro.dataHora.toISOString(),
    origem: registro.origem,
  }));

  const produtosRelatorio: ProdutoRelatorio[] = produtos.map((produto) => ({
    opId: produto.id,
    opNumero: produto.numeroSequencia,
    lote: produto.lote,
    modeloCodigo: produto.modelo.codigo,
    modeloNome: produto.modelo.nome,
    quantidade: produto.quantidade,
    status: produto.status,
    inicio: produto.dataLiberacao.toISOString(),
    fim: produto.dataFinalizacao?.toISOString() ?? null,
    tempoOPSegundos: Math.max(
      0,
      Math.floor(((produto.dataFinalizacao ?? new Date()).getTime() - produto.dataLiberacao.getTime()) / 1000),
    ),
  }));

  const processosAtivosRelatorio: ProcessoAtivoRelatorio[] = processosAtivos.map((processo) => ({
    id: processo.id,
    opNumero: processo.op.numeroSequencia,
    modeloCodigo: processo.op.modelo.codigo,
    pecaNome: processo.peca?.nome ?? null,
    setorNome: processo.setor.nome,
    usuario: processo.usuario,
    maquinaCodigo: processo.maquina.codigo,
    iniciadoEm: processo.iniciadoEm.toISOString(),
  }));

  const modelosEngate: ModeloEngateRelatorio[] = modelos.map((modelo) => ({
    id: modelo.id,
    codigo: modelo.codigo,
    nome: modelo.nome,
    curva: modelo.curva,
    tipo: modelo.tipo,
    tamanhoPonteira: modelo.tamanhoPonteira,
    estoqueMinimo: modelo.estoqueMinimo,
    linhaProduto: modelo.linhaProduto,
  }));

  return (
    <div className="flex flex-col gap-5 p-3 sm:gap-6 sm:p-6">
      <PageHeader
        title="Relatórios e Capacidade"
        subtitle="Produção, produtividade, ficha completa dos engates e capacidade dos setores"
      />
      <RelatoriosProducao
        registros={registrosRelatorio}
        produtos={produtosRelatorio}
        processosAtivos={processosAtivosRelatorio}
        modelosEngate={modelosEngate}
        capacidadeSetores={capacidadeSetores}
      />
    </div>
  );
}
