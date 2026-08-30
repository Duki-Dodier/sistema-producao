import Link from "next/link";
import { NestForm } from "@/components/nest-form";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

const statusLabel: Record<string, string> = {
  PROGRAMADO: "Programado",
  EM_CORTE: "Em corte",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

const statusClass: Record<string, string> = {
  PROGRAMADO: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  EM_CORTE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  PAUSADO: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  CONCLUIDO: "border-slate-600 bg-slate-800 text-slate-300",
  CANCELADO: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

function ehPlasma(nome: string) {
  return ehSetor(nome, "Plasma Chapa") || ehSetor(nome, "Plasma Tubo");
}

function numero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

function tempo(segundos: number | null) {
  if (segundos === null) return "-";
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = segundos % 60;
  return [horas, minutos, resto].map((unidade) => String(unidade).padStart(2, "0")).join(":");
}

function dataHora(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

export default async function PlasmaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const busca = String(sp.q ?? "").trim();
  const statusFiltro = ["PROGRAMADO", "EM_CORTE", "PAUSADO", "CONCLUIDO", "CANCELADO"].includes(String(sp.status ?? ""))
    ? String(sp.status)
    : "";
  const maquinaFiltro = Number(sp.maquina);
  const operadorFiltro = Number(sp.operador);
  const setorFiltro = Number(sp.setor);
  const paginaAtual = Math.max(1, Number.isInteger(Number(sp.pagina)) ? Number(sp.pagina) : 1);
  const porPagina = 20;
  const usuario = await buscarOperadorLogado();
  const todosSetores = await prisma.setor.findMany({ select: { id: true, nome: true }, orderBy: { ordemPadrao: "asc" } });
  const setores = todosSetores.filter((setor) => ehPlasma(setor.nome));
  const setorIds = setores.map((setor) => setor.id);

  const whereNest = {
    ...(statusFiltro ? { status: statusFiltro } : {}),
    ...(Number.isInteger(maquinaFiltro) && maquinaFiltro > 0 ? { maquinaId: maquinaFiltro } : {}),
    ...(Number.isInteger(operadorFiltro) && operadorFiltro > 0 ? { programadorId: operadorFiltro } : {}),
    ...(Number.isInteger(setorFiltro) && setorFiltro > 0 ? { setorId: setorFiltro } : {}),
    ...(busca ? {
      OR: [
        { codigo: { contains: busca } },
        { nomeArquivo: { contains: busca } },
        { programador: { nome: { contains: busca } } },
        { eventos: { some: { funcionario: { nome: { contains: busca } } } } },
        { itens: { some: { peca: { codigo: { contains: busca } } } } },
        { itens: { some: { peca: { nome: { contains: busca } } } } },
        { itens: { some: { op: { lote: { contains: busca } } } } },
        { itens: { some: { op: { modelo: { codigo: { contains: busca } } } } } },
        { itens: { some: { lancamentos: { some: { funcionario: { nome: { contains: busca } } } } } } },
      ],
    } : {}),
  };

  const [maquinas, operadores, ops, totalNests, nests] = await Promise.all([
    prisma.maquina.findMany({
      where: { setorId: { in: setorIds }, ativo: true },
      select: { id: true, codigo: true, nome: true, setorId: true },
      orderBy: [{ setorId: "asc" }, { codigo: "asc" }],
    }),
    prisma.funcionario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.oP.findMany({
      where: { status: "ABERTA" },
      select: {
        id: true,
        lote: true,
        numeroSequencia: true,
        modelo: {
          select: {
            codigo: true,
            pecas: {
              select: {
                peca: {
                  select: {
                    id: true,
                    codigo: true,
                    nome: true,
                    medida: true,
                    setorId: true,
                    roteiro: { select: { setorId: true, processo: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ numeroSequencia: "asc" }, { createdAt: "asc" }],
    }),
    prisma.nestCorte.count({ where: whereNest }),
    prisma.nestCorte.findMany({
      where: whereNest,
      include: {
        setor: { select: { nome: true } },
        maquina: { select: { codigo: true, nome: true } },
        programador: { select: { nome: true } },
        itens: {
          include: {
            peca: { select: { codigo: true, nome: true } },
            op: { select: { lote: true, modelo: { select: { codigo: true } } } },
            lancamentos: { select: { quantidadeBoa: true, quantidadeRefugo: true, dataHora: true, funcionario: { select: { nome: true } } } },
          },
        },
        eventos: { select: { tipo: true, dataHora: true, funcionario: { select: { nome: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (paginaAtual - 1) * porPagina,
      take: porPagina,
    }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(totalNests / porPagina));
  const hrefPagina = (pagina: number) => {
    const params = new URLSearchParams();
    if (busca) params.set("q", busca);
    if (statusFiltro) params.set("status", statusFiltro);
    if (Number.isInteger(maquinaFiltro) && maquinaFiltro > 0) params.set("maquina", String(maquinaFiltro));
    if (Number.isInteger(operadorFiltro) && operadorFiltro > 0) params.set("operador", String(operadorFiltro));
    if (Number.isInteger(setorFiltro) && setorFiltro > 0) params.set("setor", String(setorFiltro));
    params.set("pagina", String(pagina));
    return `/plasma?${params.toString()}`;
  };

  const opcoesItem = ops.flatMap((op) =>
    op.modelo.pecas.flatMap((componente) => {
      const setoresDaPeca = new Set<number>();
      if (setorIds.includes(componente.peca.setorId)) setoresDaPeca.add(componente.peca.setorId);
      componente.peca.roteiro.forEach((etapa) => {
        if (setorIds.includes(etapa.setorId) && etapa.processo.toUpperCase().includes("CORTE")) setoresDaPeca.add(etapa.setorId);
      });
      return [...setoresDaPeca].map((setorId) => ({
        referencia: `${op.id}:${componente.peca.id}`,
        setorId,
        codigoPeca: componente.peca.codigo,
        descricao: `OP ${op.lote ?? `#${op.id}`} · ${op.modelo.codigo} · ${componente.peca.codigo} - ${componente.peca.nome}${componente.peca.medida ? ` (${componente.peca.medida})` : ""}`,
      }));
    }),
  );

  const programados = nests.filter((nest) => nest.status === "PROGRAMADO").length;
  const emCorte = nests.filter((nest) => nest.status === "EM_CORTE").length;
  const planejadas = nests.reduce((total, nest) => total + nest.itens.reduce((soma, item) => soma + item.quantidadePlanejada, 0), 0);
  const produzidas = nests.reduce(
    (total, nest) => total + nest.itens.reduce((soma, item) => soma + item.lancamentos.reduce((lancado, itemLancado) => lancado + itemLancado.quantidadeBoa, 0), 0),
    0,
  );
  const podeProgramar = Boolean(
    usuario && (usuario.administrador || ["LIDER", "PCP"].includes(usuario.papel) || (usuario.papel === "OPERADOR" && setorIds.includes(usuario.setorId))),
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6">
      <section className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-[#1a3142] via-[#1d2a38] to-[#202a36] p-5 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Programação e rastreabilidade de corte</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Plasma</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">Controle cada chapa programada, as peças de cada OP, tempos e aproveitamento. As baixas feitas no nest já alimentam a produção da fábrica.</p>
          </div>
          <div className="rounded-lg border border-cyan-300/20 bg-[#0c1722]/60 px-3 py-2 text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Referência Libellula</p>
            <p className="mt-0.5 text-xs font-semibold text-cyan-100">Chapa, peso, corte e perfurações</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador rotulo="Aguardando corte" valor={numero(programados)} cor="text-sky-200" />
          <Indicador rotulo="Em corte agora" valor={numero(emCorte)} cor="text-emerald-200" />
          <Indicador rotulo="Peças planejadas" valor={numero(planejadas)} cor="text-cyan-200" />
          <Indicador rotulo="Peças baixadas" valor={numero(produzidas)} cor="text-amber-200" />
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
        <form method="get" className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_10rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="block"><span className={filterLabelClass}>Buscar NEST, peça, modelo, lote ou operador</span><input name="q" defaultValue={busca} placeholder="Ex.: NEST3530 ou AD1000" className={filterInputClass} /></label>
          <label className="block"><span className={filterLabelClass}>Situação</span><select name="status" defaultValue={statusFiltro} className={filterInputClass}><option value="">Todas</option>{Object.entries(statusLabel).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</select></label>
          <label className="block"><span className={filterLabelClass}>Máquina</span><select name="maquina" defaultValue={Number.isInteger(maquinaFiltro) && maquinaFiltro > 0 ? String(maquinaFiltro) : ""} className={filterInputClass}><option value="">Todas</option>{maquinas.map((maquina) => <option key={maquina.id} value={maquina.id}>{maquina.codigo} · {maquina.nome}</option>)}</select></label>
          <label className="block"><span className={filterLabelClass}>Programador</span><select name="operador" defaultValue={Number.isInteger(operadorFiltro) && operadorFiltro > 0 ? String(operadorFiltro) : ""} className={filterInputClass}><option value="">Todos</option>{operadores.map((operador) => <option key={operador.id} value={operador.id}>{operador.nome}</option>)}</select></label>
          <label className="block"><span className={filterLabelClass}>Setor</span><select name="setor" defaultValue={Number.isInteger(setorFiltro) && setorFiltro > 0 ? String(setorFiltro) : ""} className={filterInputClass}><option value="">Todos</option>{setores.map((setor) => <option key={setor.id} value={setor.id}>{setor.nome}</option>)}</select></label>
          <button type="submit" className="rounded bg-cyan-400 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-950 transition hover:bg-cyan-300">Buscar</button>
          {(busca || statusFiltro || (Number.isInteger(maquinaFiltro) && maquinaFiltro > 0) || (Number.isInteger(operadorFiltro) && operadorFiltro > 0) || (Number.isInteger(setorFiltro) && setorFiltro > 0)) && <Link href="/plasma" className="rounded border border-slate-600 px-4 py-2 text-center text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Limpar</Link>}
        </form>
        <div className="border-t border-slate-700/80 px-4 py-2 text-[11px] text-slate-500">{totalNests} nest{totalNests === 1 ? " encontrado" : "s encontrados"}{busca ? ` para “${busca}”` : ""}. A busca também verifica os códigos das peças e modelos dentro do nest.</div>
      </section>

      {podeProgramar && (
        <details className="group rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10" open={nests.length === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">Programar novo nest</p>
              <p className="mt-0.5 text-xs text-slate-400">Registre a programação antes de iniciar o corte na máquina.</p>
            </div>
            <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-semibold text-cyan-200 transition group-open:hidden">Abrir</span>
            <span className="hidden rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 group-open:inline">Recolher</span>
          </summary>
          <div className="border-t border-slate-700/80 p-4">
            <NestForm setores={setores} maquinas={maquinas} opcoesItem={opcoesItem} />
          </div>
        </details>
      )}

      <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Nests recentes</h3>
            <p className="mt-0.5 text-xs text-slate-500">Programação, situação da máquina e rastreabilidade por peça.</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Últimos {nests.length} registros</span>
        </div>

        {!nests.length ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-300">Nenhum nest programado ainda.</p>
            <p className="mt-1 text-xs text-slate-500">Comece registrando a chapa e as peças que serão cortadas.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/70">
            {nests.map((nest) => {
              const boas = nest.itens.reduce((total, item) => total + item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeBoa, 0), 0);
              const perdas = nest.itens.reduce((total, item) => total + item.lancamentos.reduce((soma, lancamento) => soma + lancamento.quantidadeRefugo, 0), 0);
              const planejado = nest.itens.reduce((total, item) => total + item.quantidadePlanejada, 0);
              const lancamentos = nest.itens.flatMap((item) => item.lancamentos).sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
              const ultimoLancamento = lancamentos[0];
              const eventoFim = nest.eventos.find((evento) => evento.tipo === "FIM");
              const apontadores = [...new Set(lancamentos.map((lancamento) => lancamento.funcionario.nome))];
              return (
                <Link key={nest.id} href={`/plasma/${nest.id}`} className="group block px-4 py-4 transition hover:bg-slate-800/45">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold tracking-wide text-white">{nest.codigo}</span>
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass[nest.status] ?? statusClass.PROGRAMADO}`}>{statusLabel[nest.status] ?? nest.status}</span>
                      </div>
                  <p className="mt-1 text-xs text-slate-400">{nest.setor.nome} · {nest.maquina.codigo} - {nest.maquina.nome} · Programado por {nest.programador.nome}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {ultimoLancamento ? <>Último apontamento: <span className="text-cyan-200">{ultimoLancamento.funcionario.nome}</span> em {dataHora(ultimoLancamento.dataHora)}</> : "Ainda sem apontamento de peças"}
                    {eventoFim ? <> · Concluído por <span className="text-emerald-200">{eventoFim.funcionario.nome}</span> em {dataHora(eventoFim.dataHora)}</> : ""}
                  </p>
                    </div>
                    <span className="text-xs font-semibold text-cyan-200 transition group-hover:translate-x-0.5">Ver rastreabilidade →</span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-6">
                    <MiniDado titulo="Boas" valor={`${numero(boas)} / ${numero(planejado)}`} />
                    <MiniDado titulo="A refazer" valor={numero(Math.max(0, planejado - boas))} cor="text-amber-200" />
                    <MiniDado titulo="Perdas" valor={numero(perdas)} cor="text-rose-200" />
                    <MiniDado titulo="Chapa" valor={nest.espessuraMm === null ? "-" : `${nest.espessuraMm.toLocaleString("pt-BR")} mm`} />
                    <MiniDado titulo="Aproveitamento" valor={nest.aproveitamentoPct === null ? "-" : `${nest.aproveitamentoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`} />
                    <MiniDado titulo="Tempo de corte" valor={tempo(nest.tempoCorteSegundos)} />
                  </div>

                  <p className="mt-3 line-clamp-1 text-xs text-slate-500">
                    {nest.itens.map((item) => `${item.op.lote ?? item.op.modelo.codigo}: ${item.peca.codigo} (${item.quantidadePlanejada})`).join(" · ")}
                  </p>
                  {apontadores.length > 0 && <p className="mt-1 line-clamp-1 text-[11px] text-slate-600">Apontado por: {apontadores.join(", ")}</p>}
                </Link>
              );
            })}
          </div>
        )}
        {totalPaginas > 1 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/80 px-4 py-3"><span className="text-xs text-slate-500">Página {paginaAtual} de {totalPaginas}</span><div className="flex gap-2"><Link href={hrefPagina(Math.max(1, paginaAtual - 1))} className={`rounded border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100 ${paginaAtual <= 1 ? "pointer-events-none opacity-40" : ""}`}>Anterior</Link><Link href={hrefPagina(Math.min(totalPaginas, paginaAtual + 1))} className={`rounded border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100 ${paginaAtual >= totalPaginas ? "pointer-events-none opacity-40" : ""}`}>Próxima</Link></div></div>}
      </section>
    </div>
  );
}

function Indicador({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) {
  return <div className="rounded-lg border border-white/5 bg-[#101925]/70 px-3 py-2.5"><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{rotulo}</p><p className={`mt-1 text-xl font-bold ${cor}`}>{valor}</p></div>;
}

function MiniDado({ titulo, valor, cor = "text-slate-200" }: { titulo: string; valor: string; cor?: string }) {
  return <div className="rounded border border-slate-700/80 bg-slate-950/25 px-2.5 py-2"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-0.5 font-semibold ${cor}`}>{valor}</p></div>;
}

const filterLabelClass = "mb-1 block font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500";
const filterInputClass = "w-full rounded border border-slate-700 bg-[#111925] px-2.5 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30";
