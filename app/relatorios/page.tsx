import { PageHeader } from "@/components/page-header";
import {
  RelatoriosProducao,
  type ProcessoAtivoRelatorio,
  type ProdutoRelatorio,
  type RegistroRelatorio,
} from "@/components/relatorios-producao";
import { prisma } from "@/lib/prisma";

export default async function RelatoriosPage() {
  const [registros, produtos, processosAtivos] = await Promise.all([
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
        usuario: true,
        maquina: { select: { codigo: true } },
        setor: { select: { nome: true } },
        peca: { select: { nome: true } },
        op: { select: { numeroSequencia: true, modelo: { select: { codigo: true } } } },
      },
    }),
  ]);

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

  return (
    <div className="flex flex-col gap-5 p-3 sm:gap-6 sm:p-6">
      <PageHeader
        title="Relatórios de Produção"
        subtitle="Tempo do produto principal, de cada peça e dos operadores"
      />
      <RelatoriosProducao
        registros={registrosRelatorio}
        produtos={produtosRelatorio}
        processosAtivos={processosAtivosRelatorio}
      />
    </div>
  );
}
