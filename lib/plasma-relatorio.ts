/* eslint-disable @typescript-eslint/no-explicit-any */
import { boasConferidas, perdasEfetivas, segundosEfetivos } from "@/lib/plasma-regras";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { rotuloMaquina } from "@/lib/maquinas";

export const statusLabel: Record<string, string> = {
  PROGRAMADO: "Programado",
  EM_CORTE: "Em corte",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const eventoLabel: Record<string, string> = {
  PROGRAMADO: "Programação registrada",
  INICIO: "Corte iniciado",
  PAUSA: "Corte pausado",
  RETORNO: "Corte retomado",
  FIM: "Corte concluído",
  CANCELAMENTO: "NEST cancelado",
};

export type CategoriaRegistro = "PROGRAMACAO" | "OPERACAO" | "LANCAMENTO" | "CONFERENCIA";

export type RegistroLinha = {
  id: string;
  dataHora: Date;
  categoria: CategoriaRegistro;
  acao: string;
  usuario: string;
  nestId: number | null;
  nestCodigo: string;
  maquina: string;
  op: string;
  peca: string;
  boas: number | null;
  perdas: number | null;
  detalhe: string;
  apontamentoId: number | null;
};

export type ResumoOpPeca = {
  chave: string;
  opNumero: number;
  lote: string | null;
  modelo: string;
  opQuantidade: number;
  pecaCodigo: string;
  pecaNome: string;
  programado: number;
  declarado: number;
  liberado: number;
  perdas: number;
  aguardando: number;
  reposicaoProgramada: number;
  nests: Set<string>;
  operadores: Set<string>;
  conferentes: Set<string>;
};

export type ResumoPessoa = {
  id: string;
  nome: string;
  funcoes: Set<string>;
  programacoes: number;
  eventos: number;
  lancamentos: number;
  conferencias: number;
  boasDeclaradas: number;
  perdasDeclaradas: number;
  boasLiberadas: number;
};

export type FiltrosRelatorioPlasma = {
  busca: string;
  dataInicio: string;
  dataFim: string;
  maquina: string;
  operador: string;
  status: string;
  tipo: string;
};

export type DadosRelatorioPlasma = {
  setor: { id: number; nome: string } | undefined;
  maquinas: { id: number; codigo: string; nome: string }[];
  operadores: { id: number; nome: string }[];
  nests: any[];
  apontamentos: any[];
  registrosFiltrados: RegistroLinha[];
  resumoOps: ResumoOpPeca[];
  pessoas: ResumoPessoa[];
  totalProgramado: number;
  totalDeclarado: number;
  totalLiberado: number;
  totalPerdas: number;
  aguardandoConferencia: number;
  totalTempo: number;
  totalOps: number;
  filtrosAtivos: boolean;
  periodoInvalido: boolean;
  inicioFiltro: Date | null;
  fimFiltro: Date | null;
  filtros: FiltrosRelatorioPlasma;
};

function textoBusca(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function noPeriodo(data: Date, inicio: Date | null, fim: Date | null) {
  return (!inicio || data >= inicio) && (!fim || data <= fim);
}

function dataDoFiltro(valor: string, fimDoDia = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T${fimDoDia ? "23:59:59.999" : "00:00:00.000"}-03:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function periodoRelatorioPlasma(valor: string, fimDoDia = false) {
  return dataDoFiltro(valor, fimDoDia);
}

export async function carregarRelatorioPlasma(filtros: FiltrosRelatorioPlasma): Promise<DadosRelatorioPlasma> {
  const busca = filtros.busca.trim();
  const dataInicio = filtros.dataInicio;
  const dataFim = filtros.dataFim;
  const inicioFiltro = dataDoFiltro(dataInicio);
  const fimFiltro = dataDoFiltro(dataFim, true);
  const maquinaFiltro = Number(filtros.maquina);
  const operadorFiltro = Number(filtros.operador);
  const statusFiltro = Object.hasOwn(statusLabel, filtros.status) ? filtros.status : "";
  const categoriaFiltro = ["PROGRAMACAO", "OPERACAO", "LANCAMENTO", "CONFERENCIA"].includes(filtros.tipo)
    ? filtros.tipo as CategoriaRegistro
    : "";
  const periodoInvalido = Boolean(inicioFiltro && fimFiltro && inicioFiltro > fimFiltro);

  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  const setor = setores.find((item) => ehSetor(item.nome, "Plasma Chapa"));

  const [maquinas, nestsBase, apontamentosBase] = setor
    ? await Promise.all([
        prisma.maquina.findMany({
          where: { setorId: setor.id },
          select: { id: true, codigo: true, nome: true },
          orderBy: { codigo: "asc" },
        }),
        prisma.nestCorte.findMany({
          where: { setorId: setor.id },
          include: {
            maquina: { select: { id: true, codigo: true, nome: true } },
            programador: { select: { id: true, nome: true } },
            eventos: {
              include: { funcionario: { select: { id: true, nome: true } } },
              orderBy: { dataHora: "asc" },
            },
            itens: {
              include: {
                op: {
                  select: {
                    id: true,
                    numeroSequencia: true,
                    lote: true,
                    quantidade: true,
                    status: true,
                    modelo: { select: { codigo: true, nome: true } },
                  },
                },
                peca: { select: { id: true, codigo: true, nome: true, medida: true } },
                lancamentos: {
                  include: {
                    funcionario: { select: { id: true, nome: true } },
                    conferente: { select: { id: true, nome: true } },
                    apontamento: { select: { id: true, usuario: true, dataHora: true } },
                  },
                  orderBy: { dataHora: "asc" },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 5000,
        }),
        prisma.apontamento.findMany({
          where: { setorId: setor.id, lancamentoNest: null },
          include: {
            funcionario: { select: { id: true, nome: true } },
            maquina: { select: { id: true, codigo: true, nome: true } },
            peca: { select: { id: true, codigo: true, nome: true } },
            op: {
              select: {
                id: true,
                numeroSequencia: true,
                lote: true,
                quantidade: true,
                modelo: { select: { codigo: true } },
              },
            },
          },
          orderBy: { dataHora: "desc" },
          take: 5000,
        }),
      ])
    : [[], [], []] as const;

  const pessoasOpcoes = new Map<number, string>();
  for (const nest of nestsBase) {
    pessoasOpcoes.set(nest.programador.id, nest.programador.nome);
    for (const evento of nest.eventos) pessoasOpcoes.set(evento.funcionario.id, evento.funcionario.nome);
    for (const lancamento of nest.itens.flatMap((item: any) => item.lancamentos)) {
      pessoasOpcoes.set(lancamento.funcionario.id, lancamento.funcionario.nome);
      if (lancamento.conferente) pessoasOpcoes.set(lancamento.conferente.id, lancamento.conferente.nome);
    }
  }
  for (const apontamento of apontamentosBase) {
    if (apontamento.funcionario) pessoasOpcoes.set(apontamento.funcionario.id, apontamento.funcionario.nome);
  }
  const operadores = [...pessoasOpcoes.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const termoBusca = textoBusca(busca);
  const nests = nestsBase.filter((nest) => {
    if (statusFiltro && nest.status !== statusFiltro) return false;
    if (Number.isInteger(maquinaFiltro) && maquinaFiltro > 0 && nest.maquinaId !== maquinaFiltro) return false;
    if (Number.isInteger(operadorFiltro) && operadorFiltro > 0) {
      const pessoaParticipou = nest.programadorId === operadorFiltro
        || nest.eventos.some((evento: any) => evento.funcionarioId === operadorFiltro)
        || nest.itens.some((item: any) => item.lancamentos.some((lancamento: any) => lancamento.funcionarioId === operadorFiltro || lancamento.conferenteId === operadorFiltro));
      if (!pessoaParticipou) return false;
    }
    if (termoBusca) {
      const campos = [
        nest.codigo,
        nest.nomeArquivo,
        nest.observacao,
        nest.maquina.codigo,
        nest.maquina.nome,
        nest.programador.nome,
        ...nest.eventos.flatMap((evento: any) => [evento.funcionario.nome, evento.descricao, evento.tipo]),
        ...nest.itens.flatMap((item: any) => [
          `OP ${item.op.numeroSequencia}`,
          item.op.numeroSequencia,
          item.op.lote,
          item.op.modelo.codigo,
          item.op.modelo.nome,
          item.peca.codigo,
          item.peca.nome,
          item.peca.medida,
          ...item.lancamentos.flatMap((lancamento: any) => [
            lancamento.funcionario.nome,
            lancamento.conferente?.nome,
            lancamento.motivoRefugo,
            lancamento.motivoConferencia,
            lancamento.observacao,
          ]),
        ]),
      ];
      if (!campos.some((campo) => textoBusca(campo).includes(termoBusca))) return false;
    }
    if (inicioFiltro || fimFiltro) {
      const atividades = [
        nest.createdAt,
        ...nest.eventos.map((evento: any) => evento.dataHora),
        ...nest.itens.flatMap((item: any) => item.lancamentos.flatMap((lancamento: any) => [lancamento.dataHora, ...(lancamento.conferidoEm ? [lancamento.conferidoEm] : [])])),
      ];
      if (!atividades.some((data: Date) => noPeriodo(data, inicioFiltro, fimFiltro))) return false;
    }
    return true;
  });
  const apontamentos = apontamentosBase.filter((apontamento) => {
    if (statusFiltro) return false;
    if (Number.isInteger(maquinaFiltro) && maquinaFiltro > 0 && apontamento.maquinaId !== maquinaFiltro) return false;
    if (Number.isInteger(operadorFiltro) && operadorFiltro > 0 && apontamento.funcionarioId !== operadorFiltro) return false;
    if (termoBusca) {
      const campos = [
        `OP ${apontamento.op.numeroSequencia}`,
        apontamento.op.numeroSequencia,
        apontamento.op.lote,
        apontamento.op.modelo.codigo,
        apontamento.peca?.codigo,
        apontamento.peca?.nome,
        apontamento.usuario,
        apontamento.funcionario?.nome,
        apontamento.maquina?.codigo,
        apontamento.maquina?.nome,
        apontamento.processo,
        apontamento.origem,
      ];
      if (!campos.some((campo) => textoBusca(campo).includes(termoBusca))) return false;
    }
    return noPeriodo(apontamento.dataHora, inicioFiltro, fimFiltro);
  });

  const resumoOpsMap = new Map<string, ResumoOpPeca>();
  const pessoasMap = new Map<string, ResumoPessoa>();
  const registros: RegistroLinha[] = [];

  function pessoa(funcionarioId: number | null, nome: string) {
    const id = funcionarioId === null ? `nome:${textoBusca(nome)}` : `id:${funcionarioId}`;
    let resumo = pessoasMap.get(id);
    if (!resumo) {
      resumo = { id, nome, funcoes: new Set<string>(), programacoes: 0, eventos: 0, lancamentos: 0, conferencias: 0, boasDeclaradas: 0, perdasDeclaradas: 0, boasLiberadas: 0 };
      pessoasMap.set(id, resumo);
    }
    return resumo;
  }

  for (const nest of nests) {
    const maquina = rotuloMaquina(nest.maquina.codigo, nest.maquina.nome);
    const opsDoNest = [...new Map(nest.itens.map((item: any) => [item.op.id, item.op])).values()];
    const resumoDoNest = opsDoNest.map((op: any) => `OP ${op.numeroSequencia}${op.lote ? ` · lote ${op.lote}` : ""}`).join(" | ");
    const programador = pessoa(nest.programador.id, nest.programador.nome);
    programador.funcoes.add("Programador");
    programador.programacoes += 1;

    if (!nest.eventos.some((evento: any) => evento.tipo === "PROGRAMADO")) {
      registros.push({ id: `nest-${nest.id}-criado`, dataHora: nest.createdAt, categoria: "PROGRAMACAO", acao: "Programação criada", usuario: nest.programador.nome, nestId: nest.id, nestCodigo: nest.codigo, maquina, op: resumoDoNest || "Sem OP vinculada", peca: nest.itens.map((item: any) => item.peca.codigo).join(", ") || "—", boas: null, perdas: null, detalhe: nest.refeitoDeId ? "NEST de reposição" : nest.nomeArquivo ?? "Programação do corte", apontamentoId: null });
    }

    for (const evento of nest.eventos) {
      const responsavel = pessoa(evento.funcionario.id, evento.funcionario.nome);
      if (evento.tipo === "PROGRAMADO") responsavel.funcoes.add("Programador");
      else { responsavel.funcoes.add("Operador de máquina"); responsavel.eventos += 1; }
      registros.push({ id: `evento-${evento.id}`, dataHora: evento.dataHora, categoria: evento.tipo === "PROGRAMADO" ? "PROGRAMACAO" : "OPERACAO", acao: eventoLabel[evento.tipo] ?? evento.tipo, usuario: evento.funcionario.nome, nestId: nest.id, nestCodigo: nest.codigo, maquina, op: resumoDoNest || "Sem OP vinculada", peca: nest.itens.map((item: any) => item.peca.codigo).join(", ") || "—", boas: null, perdas: null, detalhe: evento.descricao ?? "Movimentação registrada no NEST", apontamentoId: null });
    }

    for (const item of nest.itens) {
      const chave = `${item.opId}:${item.pecaId}`;
      let resumo = resumoOpsMap.get(chave);
      if (!resumo) {
        resumo = { chave, opNumero: item.op.numeroSequencia, lote: item.op.lote, modelo: item.op.modelo.codigo, opQuantidade: item.op.quantidade, pecaCodigo: item.peca.codigo, pecaNome: item.peca.nome, programado: 0, declarado: 0, liberado: 0, perdas: 0, aguardando: 0, reposicaoProgramada: 0, nests: new Set<string>(), operadores: new Set<string>(), conferentes: new Set<string>() };
        resumoOpsMap.set(chave, resumo);
      }
      resumo.programado += item.quantidadePlanejada;
      if (nest.refeitoDeId) resumo.reposicaoProgramada += item.quantidadePlanejada;
      resumo.nests.add(nest.codigo);

      for (const lancamento of item.lancamentos) {
        resumo.declarado += lancamento.quantidadeBoa;
        resumo.liberado += boasConferidas(lancamento);
        resumo.perdas += perdasEfetivas(lancamento);
        if (lancamento.apontamentoId === null) resumo.aguardando += lancamento.quantidadeBoa + lancamento.quantidadeRefugo;
        resumo.operadores.add(lancamento.funcionario.nome);
        if (lancamento.conferente) resumo.conferentes.add(lancamento.conferente.nome);
        const operador = pessoa(lancamento.funcionario.id, lancamento.funcionario.nome);
        operador.funcoes.add("Operador"); operador.lancamentos += 1; operador.boasDeclaradas += lancamento.quantidadeBoa; operador.perdasDeclaradas += lancamento.quantidadeRefugo;
        registros.push({ id: `lancamento-${lancamento.id}`, dataHora: lancamento.dataHora, categoria: "LANCAMENTO", acao: lancamento.tipo === "RETRABALHO" ? "Reposição declarada" : "Produção declarada", usuario: lancamento.funcionario.nome, nestId: nest.id, nestCodigo: nest.codigo, maquina, op: `OP ${item.op.numeroSequencia}${item.op.lote ? ` · lote ${item.op.lote}` : ""}`, peca: `${item.peca.codigo} · ${item.peca.nome}`, boas: lancamento.quantidadeBoa, perdas: lancamento.quantidadeRefugo, detalhe: lancamento.motivoRefugo ?? lancamento.observacao ?? "Quantidade informada pelo operador", apontamentoId: lancamento.apontamentoId });
        if (lancamento.apontamentoId !== null) {
          const dataConferencia = lancamento.conferidoEm ?? lancamento.apontamento?.dataHora ?? lancamento.dataHora;
          const nomeConferente = lancamento.conferente?.nome ?? lancamento.apontamento?.usuario ?? "Registro oficial";
          if (lancamento.conferente) { const conferente = pessoa(lancamento.conferente.id, lancamento.conferente.nome); conferente.funcoes.add("Conferente"); conferente.conferencias += 1; conferente.boasLiberadas += boasConferidas(lancamento); }
          registros.push({ id: `conferencia-${lancamento.id}`, dataHora: dataConferencia, categoria: "CONFERENCIA", acao: lancamento.conferidoEm ? "Conferido e liberado" : "Produção oficial registrada", usuario: nomeConferente, nestId: nest.id, nestCodigo: nest.codigo, maquina, op: `OP ${item.op.numeroSequencia}${item.op.lote ? ` · lote ${item.op.lote}` : ""}`, peca: `${item.peca.codigo} · ${item.peca.nome}`, boas: boasConferidas(lancamento), perdas: perdasEfetivas(lancamento), detalhe: lancamento.motivoConferencia ?? `Apontamento oficial #${lancamento.apontamentoId}`, apontamentoId: lancamento.apontamentoId });
        }
      }
    }
  }

  for (const apontamento of apontamentos) {
    const chave = `${apontamento.opId}:${apontamento.pecaId ?? "produto"}`;
    let resumo = resumoOpsMap.get(chave);
    if (!resumo) {
      resumo = { chave, opNumero: apontamento.op.numeroSequencia, lote: apontamento.op.lote, modelo: apontamento.op.modelo.codigo, opQuantidade: apontamento.op.quantidade, pecaCodigo: apontamento.peca?.codigo ?? "PRODUTO", pecaNome: apontamento.peca?.nome ?? "Produto principal da OP", programado: 0, declarado: 0, liberado: 0, perdas: 0, aguardando: 0, reposicaoProgramada: 0, nests: new Set<string>(), operadores: new Set<string>(), conferentes: new Set<string>() };
      resumoOpsMap.set(chave, resumo);
    }
    resumo.declarado += apontamento.quantidadeBoa;
    resumo.liberado += apontamento.quantidadeBoa;
    resumo.perdas += apontamento.quantidadeRefugo;
    resumo.operadores.add(apontamento.funcionario?.nome ?? apontamento.usuario);
    const responsavel = pessoa(apontamento.funcionarioId, apontamento.funcionario?.nome ?? apontamento.usuario);
    responsavel.funcoes.add("Apontamento oficial"); responsavel.lancamentos += 1; responsavel.boasDeclaradas += apontamento.quantidadeBoa; responsavel.perdasDeclaradas += apontamento.quantidadeRefugo; responsavel.boasLiberadas += apontamento.quantidadeBoa;
    registros.push({ id: `apontamento-${apontamento.id}`, dataHora: apontamento.dataHora, categoria: "LANCAMENTO", acao: "Apontamento oficial registrado", usuario: apontamento.funcionario?.nome ?? apontamento.usuario, nestId: null, nestCodigo: "Sem NEST vinculado", maquina: apontamento.maquina ? rotuloMaquina(apontamento.maquina.codigo, apontamento.maquina.nome) : "Máquina não informada", op: `OP ${apontamento.op.numeroSequencia}${apontamento.op.lote ? ` · lote ${apontamento.op.lote}` : ""}`, peca: apontamento.peca ? `${apontamento.peca.codigo} · ${apontamento.peca.nome}` : "Produto principal da OP", boas: apontamento.quantidadeBoa, perdas: apontamento.quantidadeRefugo, detalhe: `${apontamento.processo ?? "Produção"} · origem ${apontamento.origem}`, apontamentoId: apontamento.id });
  }

  const registrosFiltrados = registros.filter((registro) => !categoriaFiltro || registro.categoria === categoriaFiltro).filter((registro) => noPeriodo(registro.dataHora, inicioFiltro, fimFiltro)).sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
  const resumoOps = [...resumoOpsMap.values()].sort((a, b) => a.opNumero - b.opNumero || a.pecaCodigo.localeCompare(b.pecaCodigo, "pt-BR"));
  const pessoas = [...pessoasMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const itens = nests.flatMap((nest) => nest.itens);
  const lancamentos = itens.flatMap((item) => item.lancamentos);
  const totalProgramado = itens.reduce((soma, item) => soma + item.quantidadePlanejada, 0);
  const totalDeclarado = lancamentos.reduce((soma, item) => soma + item.quantidadeBoa, 0) + apontamentos.reduce((soma, item) => soma + item.quantidadeBoa, 0);
  const totalLiberado = lancamentos.reduce((soma, item) => soma + boasConferidas(item), 0) + apontamentos.reduce((soma, item) => soma + item.quantidadeBoa, 0);
  const totalPerdas = lancamentos.reduce((soma, item) => soma + perdasEfetivas(item), 0) + apontamentos.reduce((soma, item) => soma + item.quantidadeRefugo, 0);
  const aguardandoConferencia = lancamentos.filter((item) => item.apontamentoId === null).reduce((soma, item) => soma + item.quantidadeBoa + item.quantidadeRefugo, 0);
  const totalTempo = nests.reduce((soma, nest) => soma + (nest.tempoCorteSegundos ?? segundosEfetivos(nest.eventos)), 0);
  const totalOps = new Set([...itens.map((item) => item.opId), ...apontamentos.map((item) => item.opId)]).size;
  const filtrosAtivos = Boolean(busca || dataInicio || dataFim || statusFiltro || categoriaFiltro || (Number.isInteger(maquinaFiltro) && maquinaFiltro > 0) || (Number.isInteger(operadorFiltro) && operadorFiltro > 0));

  return { setor, maquinas, operadores, nests, apontamentos, registrosFiltrados, resumoOps, pessoas, totalProgramado, totalDeclarado, totalLiberado, totalPerdas, aguardandoConferencia, totalTempo, totalOps, filtrosAtivos, periodoInvalido, inicioFiltro, fimFiltro, filtros };
}
