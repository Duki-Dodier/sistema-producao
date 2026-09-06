import Link from "next/link";
import { DateFilter } from "@/components/date-filter";
import { rotuloMaquina } from "@/lib/maquinas";
import { boasConferidas, perdasEfetivas, segundosEfetivos } from "@/lib/plasma-regras";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

const statusLabel: Record<string, string> = {
  PROGRAMADO: "Programado",
  EM_CORTE: "Em corte",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

const eventoLabel: Record<string, string> = {
  PROGRAMADO: "Programação registrada",
  INICIO: "Corte iniciado",
  PAUSA: "Corte pausado",
  RETORNO: "Corte retomado",
  FIM: "Corte concluído",
  CANCELAMENTO: "NEST cancelado",
};

type CategoriaRegistro = "PROGRAMACAO" | "OPERACAO" | "LANCAMENTO" | "CONFERENCIA";

type RegistroLinha = {
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

type ResumoOpPeca = {
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

type ResumoPessoa = {
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

function parametro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

function dataHora(valor: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(valor);
}

function duracao(segundos: number) {
  if (segundos <= 0) return "—";
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = segundos % 60;
  return [horas, minutos, resto].map((parte) => String(parte).padStart(2, "0")).join(":");
}

function dataDoFiltro(valor: string, fimDoDia = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T${fimDoDia ? "23:59:59.999" : "00:00:00.000"}-03:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function textoBusca(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function noPeriodo(data: Date, inicio: Date | null, fim: Date | null) {
  return (!inicio || data >= inicio) && (!fim || data <= fim);
}

function classeCategoria(categoria: CategoriaRegistro) {
  return {
    PROGRAMACAO: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    OPERACAO: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    LANCAMENTO: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    CONFERENCIA: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  }[categoria];
}

function rotuloCategoria(categoria: CategoriaRegistro) {
  return {
    PROGRAMACAO: "Programação",
    OPERACAO: "Operação",
    LANCAMENTO: "Apontamento do operador",
    CONFERENCIA: "Conferência",
  }[categoria];
}

export default async function PlasmaRelatorioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const busca = parametro(sp.q).trim();
  const dataInicio = parametro(sp.dataInicio);
  const dataFim = parametro(sp.dataFim);
  const inicioFiltro = dataDoFiltro(dataInicio);
  const fimFiltro = dataDoFiltro(dataFim, true);
  const maquinaFiltro = Number(parametro(sp.maquina));
  const operadorFiltro = Number(parametro(sp.operador));
  const statusFiltro = Object.hasOwn(statusLabel, parametro(sp.status)) ? parametro(sp.status) : "";
  const categoriaFiltro = ["PROGRAMACAO", "OPERACAO", "LANCAMENTO", "CONFERENCIA"].includes(parametro(sp.tipo))
    ? parametro(sp.tipo) as CategoriaRegistro
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
    : [[], [], []];

  const pessoasOpcoes = new Map<number, string>();
  for (const nest of nestsBase) {
    pessoasOpcoes.set(nest.programador.id, nest.programador.nome);
    for (const evento of nest.eventos) pessoasOpcoes.set(evento.funcionario.id, evento.funcionario.nome);
    for (const lancamento of nest.itens.flatMap((item) => item.lancamentos)) {
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
        || nest.eventos.some((evento) => evento.funcionarioId === operadorFiltro)
        || nest.itens.some((item) => item.lancamentos.some((lancamento) => lancamento.funcionarioId === operadorFiltro || lancamento.conferenteId === operadorFiltro));
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
        ...nest.eventos.flatMap((evento) => [evento.funcionario.nome, evento.descricao, evento.tipo]),
        ...nest.itens.flatMap((item) => [
          `OP ${item.op.numeroSequencia}`,
          item.op.numeroSequencia,
          item.op.lote,
          item.op.modelo.codigo,
          item.op.modelo.nome,
          item.peca.codigo,
          item.peca.nome,
          item.peca.medida,
          ...item.lancamentos.flatMap((lancamento) => [
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
        ...nest.eventos.map((evento) => evento.dataHora),
        ...nest.itens.flatMap((item) => item.lancamentos.flatMap((lancamento) => [lancamento.dataHora, ...(lancamento.conferidoEm ? [lancamento.conferidoEm] : [])])),
      ];
      if (!atividades.some((data) => noPeriodo(data, inicioFiltro, fimFiltro))) return false;
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
      resumo = {
        id,
        nome,
        funcoes: new Set<string>(),
        programacoes: 0,
        eventos: 0,
        lancamentos: 0,
        conferencias: 0,
        boasDeclaradas: 0,
        perdasDeclaradas: 0,
        boasLiberadas: 0,
      };
      pessoasMap.set(id, resumo);
    }
    return resumo;
  }

  for (const nest of nests) {
    const maquina = rotuloMaquina(nest.maquina.codigo, nest.maquina.nome);
    const opsDoNest = [...new Map(nest.itens.map((item) => [item.op.id, item.op])).values()];
    const resumoDoNest = opsDoNest.map((op) => `OP ${op.numeroSequencia}${op.lote ? ` · lote ${op.lote}` : ""}`).join(" | ");
    const programador = pessoa(nest.programador.id, nest.programador.nome);
    programador.funcoes.add("Programador");
    programador.programacoes += 1;

    if (!nest.eventos.some((evento) => evento.tipo === "PROGRAMADO")) {
      registros.push({
        id: `nest-${nest.id}-criado`,
        dataHora: nest.createdAt,
        categoria: "PROGRAMACAO",
        acao: "Programação criada",
        usuario: nest.programador.nome,
        nestId: nest.id,
        nestCodigo: nest.codigo,
        maquina,
        op: resumoDoNest || "Sem OP vinculada",
        peca: nest.itens.map((item) => item.peca.codigo).join(", ") || "—",
        boas: null,
        perdas: null,
        detalhe: nest.refeitoDeId ? "NEST de reposição" : nest.nomeArquivo ?? "Programação do corte",
        apontamentoId: null,
      });
    }

    for (const evento of nest.eventos) {
      const responsavel = pessoa(evento.funcionario.id, evento.funcionario.nome);
      if (evento.tipo === "PROGRAMADO") {
        responsavel.funcoes.add("Programador");
      } else {
        responsavel.funcoes.add("Operador de máquina");
        responsavel.eventos += 1;
      }
      registros.push({
        id: `evento-${evento.id}`,
        dataHora: evento.dataHora,
        categoria: evento.tipo === "PROGRAMADO" ? "PROGRAMACAO" : "OPERACAO",
        acao: eventoLabel[evento.tipo] ?? evento.tipo,
        usuario: evento.funcionario.nome,
        nestId: nest.id,
        nestCodigo: nest.codigo,
        maquina,
        op: resumoDoNest || "Sem OP vinculada",
        peca: nest.itens.map((item) => item.peca.codigo).join(", ") || "—",
        boas: null,
        perdas: null,
        detalhe: evento.descricao ?? "Movimentação registrada no NEST",
        apontamentoId: null,
      });
    }

    for (const item of nest.itens) {
      const chave = `${item.opId}:${item.pecaId}`;
      let resumo = resumoOpsMap.get(chave);
      if (!resumo) {
        resumo = {
          chave,
          opNumero: item.op.numeroSequencia,
          lote: item.op.lote,
          modelo: item.op.modelo.codigo,
          opQuantidade: item.op.quantidade,
          pecaCodigo: item.peca.codigo,
          pecaNome: item.peca.nome,
          programado: 0,
          declarado: 0,
          liberado: 0,
          perdas: 0,
          aguardando: 0,
          reposicaoProgramada: 0,
          nests: new Set<string>(),
          operadores: new Set<string>(),
          conferentes: new Set<string>(),
        };
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
        operador.funcoes.add("Operador");
        operador.lancamentos += 1;
        operador.boasDeclaradas += lancamento.quantidadeBoa;
        operador.perdasDeclaradas += lancamento.quantidadeRefugo;

        registros.push({
          id: `lancamento-${lancamento.id}`,
          dataHora: lancamento.dataHora,
          categoria: "LANCAMENTO",
          acao: lancamento.tipo === "RETRABALHO" ? "Reposição declarada" : "Produção declarada",
          usuario: lancamento.funcionario.nome,
          nestId: nest.id,
          nestCodigo: nest.codigo,
          maquina,
          op: `OP ${item.op.numeroSequencia}${item.op.lote ? ` · lote ${item.op.lote}` : ""}`,
          peca: `${item.peca.codigo} · ${item.peca.nome}`,
          boas: lancamento.quantidadeBoa,
          perdas: lancamento.quantidadeRefugo,
          detalhe: lancamento.motivoRefugo ?? lancamento.observacao ?? "Quantidade informada pelo operador",
          apontamentoId: lancamento.apontamentoId,
        });

        if (lancamento.apontamentoId !== null) {
          const dataConferencia = lancamento.conferidoEm ?? lancamento.apontamento?.dataHora ?? lancamento.dataHora;
          const nomeConferente = lancamento.conferente?.nome ?? lancamento.apontamento?.usuario ?? "Registro oficial";
          if (lancamento.conferente) {
            const conferente = pessoa(lancamento.conferente.id, lancamento.conferente.nome);
            conferente.funcoes.add("Conferente");
            conferente.conferencias += 1;
            conferente.boasLiberadas += boasConferidas(lancamento);
          }
          registros.push({
            id: `conferencia-${lancamento.id}`,
            dataHora: dataConferencia,
            categoria: "CONFERENCIA",
            acao: lancamento.conferidoEm ? "Conferido e liberado" : "Produção oficial registrada",
            usuario: nomeConferente,
            nestId: nest.id,
            nestCodigo: nest.codigo,
            maquina,
            op: `OP ${item.op.numeroSequencia}${item.op.lote ? ` · lote ${item.op.lote}` : ""}`,
            peca: `${item.peca.codigo} · ${item.peca.nome}`,
            boas: boasConferidas(lancamento),
            perdas: perdasEfetivas(lancamento),
            detalhe: lancamento.motivoConferencia ?? `Apontamento oficial #${lancamento.apontamentoId}`,
            apontamentoId: lancamento.apontamentoId,
          });
        }
      }
    }
  }

  for (const apontamento of apontamentos) {
    const chave = `${apontamento.opId}:${apontamento.pecaId ?? "produto"}`;
    let resumo = resumoOpsMap.get(chave);
    if (!resumo) {
      resumo = {
        chave,
        opNumero: apontamento.op.numeroSequencia,
        lote: apontamento.op.lote,
        modelo: apontamento.op.modelo.codigo,
        opQuantidade: apontamento.op.quantidade,
        pecaCodigo: apontamento.peca?.codigo ?? "PRODUTO",
        pecaNome: apontamento.peca?.nome ?? "Produto principal da OP",
        programado: 0,
        declarado: 0,
        liberado: 0,
        perdas: 0,
        aguardando: 0,
        reposicaoProgramada: 0,
        nests: new Set<string>(),
        operadores: new Set<string>(),
        conferentes: new Set<string>(),
      };
      resumoOpsMap.set(chave, resumo);
    }
    resumo.declarado += apontamento.quantidadeBoa;
    resumo.liberado += apontamento.quantidadeBoa;
    resumo.perdas += apontamento.quantidadeRefugo;
    resumo.operadores.add(apontamento.funcionario?.nome ?? apontamento.usuario);

    const responsavel = pessoa(apontamento.funcionarioId, apontamento.funcionario?.nome ?? apontamento.usuario);
    responsavel.funcoes.add("Apontamento oficial");
    responsavel.lancamentos += 1;
    responsavel.boasDeclaradas += apontamento.quantidadeBoa;
    responsavel.perdasDeclaradas += apontamento.quantidadeRefugo;
    responsavel.boasLiberadas += apontamento.quantidadeBoa;

    registros.push({
      id: `apontamento-${apontamento.id}`,
      dataHora: apontamento.dataHora,
      categoria: "LANCAMENTO",
      acao: "Apontamento oficial registrado",
      usuario: apontamento.funcionario?.nome ?? apontamento.usuario,
      nestId: null,
      nestCodigo: "Sem NEST vinculado",
      maquina: apontamento.maquina ? rotuloMaquina(apontamento.maquina.codigo, apontamento.maquina.nome) : "Máquina não informada",
      op: `OP ${apontamento.op.numeroSequencia}${apontamento.op.lote ? ` · lote ${apontamento.op.lote}` : ""}`,
      peca: apontamento.peca ? `${apontamento.peca.codigo} · ${apontamento.peca.nome}` : "Produto principal da OP",
      boas: apontamento.quantidadeBoa,
      perdas: apontamento.quantidadeRefugo,
      detalhe: `${apontamento.processo ?? "Produção"} · origem ${apontamento.origem}`,
      apontamentoId: apontamento.id,
    });
  }

  const registrosFiltrados = registros
    .filter((registro) => !categoriaFiltro || registro.categoria === categoriaFiltro)
    .filter((registro) => noPeriodo(registro.dataHora, inicioFiltro, fimFiltro))
    .sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
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

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/plasma" className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">← Voltar para o painel Plasma</Link>
          <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">Plasma Chapa · histórico operacional</p>
          <h1 className="mt-1 text-2xl font-bold uppercase text-white">RELATÓRIO E RASTREABILIDADE</h1>
          <p className="mt-1 max-w-4xl text-sm text-slate-400">Acompanhe toda a sequência do corte: programação, operação da máquina, quantidades declaradas, perdas, conferência e liberação.</p>
        </div>
        <Link href="/plasma" className="rounded border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Painel Plasma</Link>
      </header>

      {!setor && (
        <section role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">O setor Plasma Chapa não foi encontrado.</section>
      )}

      <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
        <form method="get" className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 xl:items-end">
          <label className="block sm:col-span-2 xl:col-span-2">
            <span className={filterLabelClass}>Buscar OP, lote, NEST, peça ou nome</span>
            <input name="q" defaultValue={busca} placeholder="Ex.: OP 29, NEST01 ou Tiago" className={filterInputClass} />
          </label>
          <DateFilter name="dataInicio" label="Data inicial" defaultValue={dataInicio} inputClassName={filterInputClass} />
          <DateFilter name="dataFim" label="Data final" defaultValue={dataFim} inputClassName={filterInputClass} />
          <label className="block"><span className={filterLabelClass}>Máquina</span><select name="maquina" defaultValue={Number.isInteger(maquinaFiltro) && maquinaFiltro > 0 ? String(maquinaFiltro) : ""} className={filterInputClass}><option value="">Todas</option>{maquinas.map((maquina) => <option key={maquina.id} value={maquina.id}>{rotuloMaquina(maquina.codigo, maquina.nome)}</option>)}</select></label>
          <label className="block"><span className={filterLabelClass}>Pessoa</span><select name="operador" defaultValue={Number.isInteger(operadorFiltro) && operadorFiltro > 0 ? String(operadorFiltro) : ""} className={filterInputClass}><option value="">Todas</option>{operadores.map((operador) => <option key={operador.id} value={operador.id}>{operador.nome}</option>)}</select></label>
          <label className="block"><span className={filterLabelClass}>Situação do NEST</span><select name="status" defaultValue={statusFiltro} className={filterInputClass}><option value="">Todas</option>{Object.entries(statusLabel).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</select></label>
          <label className="block"><span className={filterLabelClass}>Tipo de registro</span><select name="tipo" defaultValue={categoriaFiltro} className={filterInputClass}><option value="">Todos</option><option value="PROGRAMACAO">Programação</option><option value="OPERACAO">Operação</option><option value="LANCAMENTO">Apontamento</option><option value="CONFERENCIA">Conferência</option></select></label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-8">
            <button type="submit" className="rounded bg-violet-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-950 transition hover:bg-violet-200">Aplicar filtros</button>
            {filtrosAtivos && <Link href="/plasma/relatorio" className="rounded border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-violet-300 hover:text-violet-100">Limpar</Link>}
          </div>
        </form>
        <div className="border-t border-slate-700/80 px-4 py-2 text-xs text-slate-500">
          {periodoInvalido ? <span className="text-amber-200">A data inicial precisa ser anterior ou igual à data final.</span> : `${nests.length} NEST(s), ${apontamentos.length} apontamento(s) sem NEST e ${registrosFiltrados.length} registro(s) encontrados.`}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Kpi label="NESTs" value={numero(nests.length)} tone="violet" />
        <Kpi label="OPs" value={numero(totalOps)} tone="cyan" />
        <Kpi label="Pessoas" value={numero(pessoas.length)} tone="sky" />
        <Kpi label="Programadas" value={numero(totalProgramado)} tone="neutral" />
        <Kpi label="Boas declaradas" value={numero(totalDeclarado)} tone="sky" />
        <Kpi label="Liberadas" value={numero(totalLiberado)} tone="emerald" />
        <Kpi label="Perdas" value={numero(totalPerdas)} tone="rose" />
        <Kpi label="A conferir" value={numero(aguardandoConferencia)} tone="amber" />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
        <SectionTitle title="NESTs e ordens rastreadas" subtitle={`${nests.length} programação(ões) · tempo efetivo acumulado ${duracao(totalTempo)}`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead><tr className="border-b border-slate-700 font-mono text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3">NEST / situação</th><th className="px-4 py-3">OPs e lotes</th><th className="px-4 py-3">Máquina</th><th className="px-4 py-3">Programador</th><th className="px-4 py-3">Datas</th><th className="px-4 py-3">Quantidades</th><th className="px-4 py-3">Tempo</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>{nests.map((nest) => {
              const lancamentosNest = nest.itens.flatMap((item) => item.lancamentos);
              const planejado = nest.itens.reduce((soma, item) => soma + item.quantidadePlanejada, 0);
              const declarado = lancamentosNest.reduce((soma, item) => soma + item.quantidadeBoa, 0);
              const liberado = lancamentosNest.reduce((soma, item) => soma + boasConferidas(item), 0);
              const perdas = lancamentosNest.reduce((soma, item) => soma + perdasEfetivas(item), 0);
              const ops = [...new Map(nest.itens.map((item) => [item.op.id, item.op])).values()];
              return <tr key={nest.id} className="border-b border-slate-700/60 align-top last:border-0">
                <td className="px-4 py-3"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-cyan-100">{nest.codigo}</strong>{nest.refeitoDeId && <span className="rounded bg-rose-300/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200">Reposição</span>}</div><span className="mt-1 inline-flex rounded border border-slate-600 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">{statusLabel[nest.status] ?? nest.status}</span></td>
                <td className="px-4 py-3 text-xs text-slate-300">{ops.map((op) => <div key={op.id}><span className="font-mono text-cyan-200">OP {op.numeroSequencia}</span>{op.lote ? ` · lote ${op.lote}` : " · sem lote"}<span className="text-slate-500"> · {op.modelo.codigo}</span></div>)}</td>
                <td className="px-4 py-3 text-slate-300">{rotuloMaquina(nest.maquina.codigo, nest.maquina.nome)}</td>
                <td className="px-4 py-3"><div className="text-slate-200">{nest.programador.nome}</div><div className="mt-1 text-xs text-slate-500">{dataHora(nest.createdAt)}</div></td>
                <td className="px-4 py-3 text-xs text-slate-400"><div>Início: {nest.iniciadoEm ? dataHora(nest.iniciadoEm) : "—"}</div><div className="mt-1">Fim: {nest.finalizadoEm ? dataHora(nest.finalizadoEm) : "—"}</div></td>
                <td className="px-4 py-3 text-xs"><div><span className="text-slate-500">Programadas </span><strong className="text-white">{numero(planejado)}</strong></div><div className="mt-1"><span className="text-slate-500">Declaradas </span><strong className="text-sky-200">{numero(declarado)}</strong> · <span className="text-slate-500">Liberadas </span><strong className="text-emerald-200">{numero(liberado)}</strong> · <span className="text-slate-500">Perdas </span><strong className="text-rose-200">{numero(perdas)}</strong></div></td>
                <td className="px-4 py-3 font-mono text-amber-200">{duracao(nest.tempoCorteSegundos ?? segundosEfetivos(nest.eventos))}</td>
                <td className="px-4 py-3 text-right"><Link href={`/plasma/${nest.id}`} className="whitespace-nowrap text-xs font-semibold text-cyan-200 transition hover:text-cyan-100">Ver NEST</Link></td>
              </tr>;
            })}</tbody>
          </table>
          {nests.length === 0 && <Empty text="Nenhum NEST encontrado com os filtros selecionados." />}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
        <SectionTitle title="Produção por OP e peça" subtitle="Planejado, declarado pelo operador, liberado pelo conferente e perdas identificadas." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead><tr className="border-b border-slate-700 font-mono text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3">OP / lote</th><th className="px-4 py-3">Peça</th><th className="px-4 py-3">Programado</th><th className="px-4 py-3">Declarado</th><th className="px-4 py-3">Liberado</th><th className="px-4 py-3">Perdas</th><th className="px-4 py-3">A conferir</th><th className="px-4 py-3">NESTs / pessoas</th></tr></thead>
            <tbody>{resumoOps.map((item) => <tr key={item.chave} className="border-b border-slate-700/60 align-top last:border-0">
              <td className="px-4 py-3"><div className="font-mono font-bold text-cyan-200">OP {item.opNumero}</div><div className="mt-1 text-xs text-slate-500">{item.lote ? `Lote ${item.lote}` : "Sem lote"} · {item.modelo} · OP com {numero(item.opQuantidade)} un.</div></td>
              <td className="px-4 py-3"><div className="font-mono font-semibold text-white">{item.pecaCodigo}</div><div className="mt-1 text-xs text-slate-400">{item.pecaNome}</div></td>
              <td className="px-4 py-3 text-white">{numero(item.programado)}{item.reposicaoProgramada > 0 && <div className="mt-1 text-xs text-rose-200">{numero(item.reposicaoProgramada)} em reposição</div>}</td>
              <td className="px-4 py-3 font-semibold text-sky-200">{numero(item.declarado)}</td>
              <td className="px-4 py-3 font-semibold text-emerald-200">{numero(item.liberado)}</td>
              <td className="px-4 py-3 font-semibold text-rose-200">{numero(item.perdas)}</td>
              <td className="px-4 py-3 font-semibold text-amber-200">{numero(item.aguardando)}</td>
              <td className="px-4 py-3 text-xs text-slate-400"><div><span className="text-slate-500">NESTs:</span> {[...item.nests].join(", ") || "Sem NEST"}</div><div className="mt-1"><span className="text-slate-500">Operadores:</span> {[...item.operadores].join(", ") || "—"}</div><div className="mt-1"><span className="text-slate-500">Conferentes:</span> {[...item.conferentes].join(", ") || "—"}</div></td>
            </tr>)}</tbody>
          </table>
          {resumoOps.length === 0 && <Empty text="Nenhuma OP ou peça encontrada com os filtros selecionados." />}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
        <SectionTitle title="Pessoas envolvidas" subtitle="Responsabilidades e registros individuais no período selecionado." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead><tr className="border-b border-slate-700 font-mono text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3">Pessoa</th><th className="px-4 py-3">Atuação</th><th className="px-4 py-3">Programações</th><th className="px-4 py-3">Eventos da máquina</th><th className="px-4 py-3">Lançamentos</th><th className="px-4 py-3">Conferências</th><th className="px-4 py-3">Boas / perdas declaradas</th><th className="px-4 py-3">Peças liberadas</th></tr></thead>
            <tbody>{pessoas.map((item) => <tr key={item.id} className="border-b border-slate-700/60 last:border-0">
              <td className="px-4 py-3 font-semibold text-white">{item.nome}</td>
              <td className="px-4 py-3 text-xs text-slate-400">{[...item.funcoes].join(" · ")}</td>
              <td className="px-4 py-3 text-sky-200">{numero(item.programacoes)}</td>
              <td className="px-4 py-3 text-emerald-200">{numero(item.eventos)}</td>
              <td className="px-4 py-3 text-amber-200">{numero(item.lancamentos)}</td>
              <td className="px-4 py-3 text-violet-200">{numero(item.conferencias)}</td>
              <td className="px-4 py-3"><span className="text-sky-200">{numero(item.boasDeclaradas)}</span><span className="text-slate-500"> / </span><span className="text-rose-200">{numero(item.perdasDeclaradas)}</span></td>
              <td className="px-4 py-3 font-semibold text-emerald-200">{numero(item.boasLiberadas)}</td>
            </tr>)}</tbody>
          </table>
          {pessoas.length === 0 && <Empty text="Nenhuma pessoa encontrada com os filtros selecionados." />}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
        <SectionTitle title="Linha do tempo completa" subtitle={`${registrosFiltrados.length} evento(s) em ordem do mais recente para o mais antigo.`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1450px] text-left text-sm">
            <thead><tr className="border-b border-slate-700 font-mono text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3">Data e hora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">NEST / máquina</th><th className="px-4 py-3">OP / peça</th><th className="px-4 py-3">Boas / perdas</th><th className="px-4 py-3">Registro</th></tr></thead>
            <tbody>{registrosFiltrados.map((registro) => <tr key={registro.id} className="border-b border-slate-700/60 align-top last:border-0">
              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{dataHora(registro.dataHora)}</td>
              <td className="px-4 py-3"><span className={`inline-flex rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${classeCategoria(registro.categoria)}`}>{rotuloCategoria(registro.categoria)}</span></td>
              <td className="px-4 py-3"><div className="font-semibold text-white">{registro.acao}</div><div className="mt-1 text-xs text-slate-500">{registro.detalhe}</div></td>
              <td className="px-4 py-3 text-slate-200">{registro.usuario}</td>
              <td className="px-4 py-3">{registro.nestId ? <Link href={`/plasma/${registro.nestId}`} className="font-mono font-semibold text-cyan-200 hover:text-cyan-100">{registro.nestCodigo}</Link> : <span className="font-mono text-xs text-slate-500">{registro.nestCodigo}</span>}<div className="mt-1 text-xs text-slate-500">{registro.maquina}</div></td>
              <td className="px-4 py-3 text-xs text-slate-300"><div>{registro.op}</div><div className="mt-1 text-slate-500">{registro.peca}</div></td>
              <td className="px-4 py-3">{registro.boas === null ? <span className="text-slate-600">—</span> : <><span className="font-semibold text-emerald-200">{numero(registro.boas)}</span><span className="text-slate-500"> / </span><span className="font-semibold text-rose-200">{numero(registro.perdas ?? 0)}</span></>}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{registro.apontamentoId ? `Apontamento #${registro.apontamentoId}` : registro.id}</td>
            </tr>)}</tbody>
          </table>
          {registrosFiltrados.length === 0 && <Empty text="Nenhum registro encontrado com os filtros selecionados." />}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="border-b border-slate-700 bg-[#172238] px-4 py-3"><h2 className="text-sm font-bold uppercase tracking-wide text-slate-100">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-500">{text}</p>;
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "violet" | "cyan" | "sky" | "emerald" | "rose" | "amber" | "neutral" }) {
  const classes = {
    violet: "border-violet-400/25 bg-violet-400/5 text-violet-200",
    cyan: "border-cyan-400/25 bg-cyan-400/5 text-cyan-200",
    sky: "border-sky-400/25 bg-sky-400/5 text-sky-200",
    emerald: "border-emerald-400/25 bg-emerald-400/5 text-emerald-200",
    rose: "border-rose-400/25 bg-rose-400/5 text-rose-200",
    amber: "border-amber-400/25 bg-amber-400/5 text-amber-200",
    neutral: "border-slate-700 bg-slate-900/25 text-slate-100",
  }[tone];
  return <article className={`rounded-xl border p-4 ${classes}`}><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>;
}

const filterLabelClass = "mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500";
const filterInputClass = "w-full rounded border border-slate-700 bg-[#111925] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-1 focus:ring-violet-400/30";
