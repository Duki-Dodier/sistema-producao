import Link from "next/link";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { rotuloMaquina } from "@/lib/maquinas";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { DateFilter } from "@/components/date-filter";
import { boasConferidas, perdasEfetivas, podeConferirPlasma, segundosEfetivos } from "@/lib/plasma-regras";
import { buscarDemandaPlasma } from "@/lib/plasma-saldo";

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

const eventoLabel: Record<string, string> = {
  PROGRAMADO: "Programação criada",
  INICIO: "Corte iniciado",
  PAUSA: "Corte pausado",
  RETORNO: "Corte retomado",
  FIM: "Corte concluído",
  CANCELAMENTO: "Nest cancelado",
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

function dataDoFiltro(valor: string, fimDoDia = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(`${valor}T${fimDoDia ? "23:59:59.999" : "00:00:00.000"}-03:00`);
  if (
    Number.isNaN(data.getTime()) ||
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() + 1 !== mes ||
    data.getUTCDate() !== dia
  ) return null;
  return data;
}

export default async function PlasmaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const busca = String(sp.q ?? "").trim();
  const dataInicio = String(sp.dataInicio ?? "");
  const dataFim = String(sp.dataFim ?? "");
  const dataInicioFiltro = dataDoFiltro(dataInicio);
  const dataFimFiltro = dataDoFiltro(dataFim, true);
  const statusFiltro = ["PROGRAMADO", "EM_CORTE", "PAUSADO", "CONCLUIDO", "CANCELADO"].includes(String(sp.status ?? ""))
    ? String(sp.status)
    : "";
  const maquinaFiltro = Number(sp.maquina);
  const operadorFiltro = Number(sp.operador);
  const setorFiltro = Number(sp.setor);
  const paginaAtual = Math.max(1, Number.isInteger(Number(sp.pagina)) ? Number(sp.pagina) : 1);
  const porPagina = 25;
  const usuario = await buscarOperadorLogado();
  const todosSetores = await prisma.setor.findMany({ select: { id: true, nome: true }, orderBy: { ordemPadrao: "asc" } });
  const setores = todosSetores.filter((setor) => ehPlasma(setor.nome));
  const setorIds = setores.map((setor) => setor.id);
  const setorPlasmaChapa = setores.find((setor) => ehSetor(setor.nome, "Plasma Chapa"));

  const whereNest = {
    ...(dataInicioFiltro || dataFimFiltro ? {
      createdAt: {
        ...(dataInicioFiltro ? { gte: dataInicioFiltro } : {}),
        ...(dataFimFiltro ? { lte: dataFimFiltro } : {}),
      },
    } : {}),
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

  const [maquinas, operadores, totalNests, nests, statusResumo, lancamentosResumo, demanda, operacaoMaquinas, pendenciasConferencia, conferentePlasma] = await Promise.all([
    prisma.maquina.findMany({
      where: { setorId: { in: setorIds }, ativo: true },
      select: { id: true, codigo: true, nome: true, setorId: true },
      orderBy: [{ setorId: "asc" }, { codigo: "asc" }],
    }),
    prisma.funcionario.findMany({
      where: { ativo: true, setorId: setorPlasmaChapa?.id ?? -1, papel: { not: "CONFERENTE" } },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
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
            lancamentos: { select: { quantidadeBoa: true, quantidadeRefugo: true, quantidadeConferidaBoa: true, quantidadeConferidaRefugo: true, apontamentoId: true, dataHora: true, funcionario: { select: { nome: true } } } },
          },
        },
        eventos: { select: { tipo: true, dataHora: true, funcionario: { select: { nome: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (paginaAtual - 1) * porPagina,
      take: porPagina,
    }),
    prisma.nestCorte.groupBy({ where: whereNest, by: ["status"], _count: { _all: true } }),
    prisma.nestLancamento.findMany({ where: { item: { nest: whereNest } }, select: { quantidadeBoa: true, quantidadeRefugo: true, quantidadeConferidaBoa: true, quantidadeConferidaRefugo: true, apontamentoId: true } }),
    buscarDemandaPlasma(),
    prisma.nestCorte.findMany({
      where: { setorId: setorPlasmaChapa?.id ?? -1, status: { in: ["PROGRAMADO", "EM_CORTE", "PAUSADO"] } },
      include: { maquina: { select: { id: true, codigo: true, nome: true } }, itens: { include: { lancamentos: true } }, eventos: { select: { tipo: true, dataHora: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.nestLancamento.findMany({
      where: { apontamentoId: null, item: { nest: { setorId: { in: setorIds }, status: { in: ["CONCLUIDO", "CANCELADO"] } } } },
      include: { funcionario: { select: { nome: true } }, item: { include: { peca: { select: { codigo: true } }, op: { select: { lote: true } }, nest: { select: { id: true, codigo: true, setorId: true, setor: { select: { nome: true } } } } } } },
      orderBy: { dataHora: "asc" },
    }),
    prisma.funcionario.findFirst({ where: { ativo: true, papel: "CONFERENTE", setor: { nome: "Plasma Chapa" } }, select: { nome: true } }),
  ]);

  const statusTotal = (status: string) => statusResumo.find((item) => item.status === status)?._count._all ?? 0;
  const nestsProgramados = statusTotal("PROGRAMADO");
  const nestsEmCorte = statusTotal("EM_CORTE");
  const nestsPausados = statusTotal("PAUSADO");
  const nestsAtivos = nestsProgramados + nestsEmCorte + nestsPausados;
  const totalDeclarado = lancamentosResumo.reduce((s, l) => s + l.quantidadeBoa, 0);
  const totalBoas = lancamentosResumo.reduce((s, l) => s + boasConferidas(l), 0);
  const totalPerdas = lancamentosResumo.reduce((s, l) => s + perdasEfetivas(l), 0);
  const aguardandoConferencia = lancamentosResumo.filter(l => l.apontamentoId === null).reduce((s, l) => s + l.quantidadeBoa + l.quantidadeRefugo, 0);
  const maquinasChapa = maquinas.filter(maquina => maquina.setorId === setorPlasmaChapa?.id);
  const reposicoes = demanda.filter(item => item.setorId === setorPlasmaChapa?.id && item.reposicao > 0);
  const totalReposicao = reposicoes.reduce((s, item) => s + item.reposicao, 0);
  const podeConferir = podeConferirPlasma(usuario);
  const totalPaginas = Math.max(1, Math.ceil(totalNests / porPagina));
  const buscaDetalhada = Boolean(
    busca || dataInicioFiltro || dataFimFiltro || statusFiltro || (Number.isInteger(maquinaFiltro) && maquinaFiltro > 0) || (Number.isInteger(operadorFiltro) && operadorFiltro > 0) || (Number.isInteger(setorFiltro) && setorFiltro > 0),
  );
  const hrefComFiltros = (filtros: { dataInicio?: string; dataFim?: string; pagina?: number } = {}) => {
    const params = new URLSearchParams();
    if (busca) params.set("q", busca);
    if (statusFiltro) params.set("status", statusFiltro);
    if (Number.isInteger(maquinaFiltro) && maquinaFiltro > 0) params.set("maquina", String(maquinaFiltro));
    if (Number.isInteger(operadorFiltro) && operadorFiltro > 0) params.set("operador", String(operadorFiltro));
    if (Number.isInteger(setorFiltro) && setorFiltro > 0) params.set("setor", String(setorFiltro));
    if (filtros.dataInicio) params.set("dataInicio", filtros.dataInicio);
    if (filtros.dataFim) params.set("dataFim", filtros.dataFim);
    if (filtros.pagina) params.set("pagina", String(filtros.pagina));
    return `/plasma?${params.toString()}`;
  };
  const hrefPagina = (pagina: number) => hrefComFiltros({ dataInicio, dataFim, pagina });
  const periodoRapido = (diasAtras: number) => {
    const data = new Date();
    data.setDate(data.getDate() - diasAtras);
    const valor = [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
    return hrefComFiltros({ dataInicio: valor, dataFim: valor });
  };
  const periodoInvalido = dataInicio !== "" && dataFim !== "" && dataInicioFiltro && dataFimFiltro && dataInicioFiltro > dataFimFiltro;
  const cadastroConcluido = sp.cadastrado === "1";
  const podeProgramar = Boolean(
    usuario && (usuario.administrador || usuario.papel === "PCP" || (["LIDER", "OPERADOR"].includes(usuario.papel) && setorIds.includes(usuario.setorId))),
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6">
      <section className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-[#1a3142] via-[#1d2a38] to-[#202a36] p-5 shadow-xl shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Painel de programação e corte</p>
            <h2 className="mt-1 text-2xl font-bold text-white">PLASMA</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">Da programação à conferência: cada corte registra máquina, pessoas, tempo, boas e perdas.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <span className="rounded bg-sky-400/10 px-2.5 py-1.5 text-sky-200">1 Programação</span><span aria-hidden="true" className="text-slate-600">→</span>
              <span className="rounded bg-emerald-400/10 px-2.5 py-1.5 text-emerald-200">2 Operação</span><span aria-hidden="true" className="text-slate-600">→</span>
              <span className="rounded bg-amber-400/10 px-2.5 py-1.5 text-amber-200">3 Conferência</span><span aria-hidden="true" className="text-slate-600">→</span>
              <span className="rounded bg-cyan-400/10 px-2.5 py-1.5 text-cyan-200">4 OP liberada</span>
            </div>
          </div>
          {podeProgramar && (
            <Link href="/plasma/novo" className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300">
              PROGRAMAR NOVO NEST <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </section>

      {!conferentePlasma && (
        <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/35 bg-amber-400/10 px-4 py-3">
          <div><p className="text-sm font-semibold text-amber-100">Defina o conferente único do Plasma.</p><p className="mt-0.5 text-xs text-amber-100/75">Até essa pessoa ser designada, os cortes declarados ficarão aguardando liberação.</p></div>
          {usuario?.administrador && <Link href="/configuracoes" className="rounded border border-amber-300/40 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/10">Abrir configurações</Link>}
        </section>
      )}

      {cadastroConcluido && (
        <section role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-100">NEST cadastrado com sucesso.</p>
            <p className="mt-0.5 text-xs text-emerald-200/80">O novo NEST está no início da lista abaixo, aguardando o corte.</p>
          </div>
          <Link href="/plasma" className="rounded border border-emerald-300/30 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/10">Fechar aviso</Link>
        </section>
      )}

      <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 px-4 py-3">
          <div><h3 className="text-base font-bold uppercase tracking-wide text-slate-100">Máquinas · Plasma Chapa</h3><p className="mt-1 text-sm text-slate-400">Situação das seis máquinas e sua fila programada.</p></div>
          <span className="rounded border border-slate-600 px-2.5 py-1 text-xs font-bold text-slate-300">{maquinasChapa.length} máquinas ativas</span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {maquinasChapa.map(maquina => {
            const fila = operacaoMaquinas.filter(nest => nest.maquinaId === maquina.id);
            const atual = fila.find(nest => ["EM_CORTE", "PAUSADO"].includes(nest.status)) ?? fila[0];
            const planejado = atual?.itens.reduce((s, item) => s + item.quantidadePlanejada, 0) ?? 0;
            const declarado = atual?.itens.flatMap(item => item.lancamentos).reduce((s, item) => s + item.quantidadeBoa + item.quantidadeRefugo, 0) ?? 0;
            const cor = atual?.status === "EM_CORTE" ? "border-emerald-400/40" : atual?.status === "PAUSADO" ? "border-amber-400/40" : atual ? "border-sky-400/30" : "border-slate-700";
            return <article key={maquina.id} className={`rounded-lg border ${cor} bg-[#111925]/65 p-4`}>
              <div className="flex items-start justify-between gap-2"><div><p className="text-base font-bold text-white">{rotuloMaquina(maquina.codigo, maquina.nome)}</p><p className="mt-1 text-xs text-slate-500">{fila.length > 1 ? `${fila.length - 1} NEST(s) na fila` : "Sem fila adicional"}</p></div><span className={`h-2.5 w-2.5 rounded-full ${atual?.status === "EM_CORTE" ? "bg-emerald-400" : atual?.status === "PAUSADO" ? "bg-amber-400" : atual ? "bg-sky-400" : "bg-slate-600"}`} /></div>
              {atual ? <Link href={`/plasma/${atual.id}`} className="mt-4 block rounded border border-white/5 bg-black/15 p-3 transition hover:border-cyan-400/30">
                <div className="flex items-center justify-between gap-2"><strong className="font-mono text-sm text-cyan-100">{atual.codigo}</strong><span className="text-xs font-bold uppercase text-slate-400">{statusLabel[atual.status]}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full bg-cyan-400" style={{ width: `${planejado ? Math.min(100, Math.round(declarado / planejado * 100)) : 0}%` }} /></div>
                <p className="mt-2 text-xs text-slate-400">Declarado {declarado}/{planejado} · tempo {tempo(segundosEfetivos(atual.eventos))}</p>
              </Link> : <div className="mt-4 rounded border border-dashed border-slate-700 px-3 py-5 text-center text-sm text-slate-500">Disponível</div>}
            </article>;
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-amber-400/20 bg-[#202a36] shadow-lg shadow-black/10">
          <div className="flex items-center justify-between gap-3 border-b border-amber-400/15 px-4 py-3"><div><h3 className="text-base font-bold text-amber-100">Aguardando conferência</h3><p className="mt-1 text-sm text-slate-400">Só o conferente do Plasma transforma estes valores em produção oficial.</p></div><strong className="text-2xl text-amber-200">{pendenciasConferencia.length}</strong></div>
          <div className="divide-y divide-slate-700/70">
            {pendenciasConferencia.slice(0, 5).map(item => <Link key={item.id} href={`/plasma/${item.item.nest.id}#conferencia`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-amber-400/5"><span><strong className="text-slate-100">{item.item.nest.codigo}</strong><span className="ml-2 text-slate-400">{item.item.peca.codigo} · OP {item.item.op.lote ?? `#${item.item.opId}`}</span><span className="mt-1 block text-xs text-slate-500">{item.item.nest.setor.nome} · declarado por {item.funcionario.nome}</span></span><span className="shrink-0 font-bold text-amber-200">{item.quantidadeBoa} boas / {item.quantidadeRefugo} perdas</span></Link>)}
            {!pendenciasConferencia.length && <p className="px-4 py-7 text-center text-sm text-slate-500">Nenhum corte aguardando conferência.</p>}
          </div>
          {pendenciasConferencia.length > 0 && <p className="border-t border-slate-700 px-4 py-2 text-xs text-slate-500">{podeConferir ? "Seu usuário é o responsável por esta conferência." : conferentePlasma ? `Somente ${conferentePlasma.nome}, conferente designado, pode validar.` : "Aguardando a designação do conferente."}</p>}
        </section>

        <section className="rounded-xl border border-rose-400/20 bg-[#202a36] shadow-lg shadow-black/10">
          <div className="flex items-center justify-between gap-3 border-b border-rose-400/15 px-4 py-3"><div><h3 className="text-base font-bold text-rose-100">Peças perdidas para repor</h3><p className="mt-1 text-sm text-slate-400">Fila consolidada para programar várias reposições juntas.</p></div><strong className="text-2xl text-rose-200">{numero(totalReposicao)}</strong></div>
          <div className="divide-y divide-slate-700/70">
            {reposicoes.slice(0, 5).map(item => <div key={`${item.setorId}:${item.referencia}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span><strong className="text-slate-100">{item.codigo}</strong><span className="ml-2 text-slate-400">{item.opLabel}</span></span><strong className="shrink-0 text-rose-200">{item.reposicao} a repor</strong></div>)}
            {!reposicoes.length && <p className="px-4 py-7 text-center text-sm text-slate-500">Nenhuma perda pendente de reposição.</p>}
          </div>
          {podeProgramar && reposicoes.length > 0 && <div className="border-t border-slate-700 p-3"><Link href="/plasma/novo?reposicao=1" className="block rounded bg-rose-300 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-950 transition hover:bg-rose-200">Programar reposições juntas</Link></div>}
        </section>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="NESTS ativos" valor={numero(nestsAtivos)} cor="text-cyan-200" />
        <Indicador rotulo="Boas declaradas" valor={numero(totalDeclarado)} cor="text-sky-200" />
        <Indicador rotulo="Peças a conferir" valor={numero(aguardandoConferencia)} cor="text-amber-200" />
        <Indicador rotulo="Liberadas / perdas sinalizadas" valor={`${numero(totalBoas)} / ${numero(totalPerdas)}`} cor="text-emerald-200" />
      </section>

      <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
        <form method="get" className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(0,2fr)_minmax(7rem,0.8fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(7rem,0.8fr)_minmax(8rem,0.9fr)_minmax(8rem,0.9fr)_auto_auto] xl:items-end">
          <label className="block sm:col-span-2 xl:col-span-1"><span className={filterLabelClass}>Buscar NEST, peça, modelo, lote ou operador</span><input name="q" defaultValue={busca} placeholder="Ex.: NEST3530 ou AD1000" className={filterInputClass} /></label>
          <label className="block"><span className={filterLabelClass}>Situação</span><select name="status" defaultValue={statusFiltro} className={filterInputClass}><option value="">Todas</option>{Object.entries(statusLabel).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</select></label>
          <label className="block"><span className={filterLabelClass}>Máquina</span><select name="maquina" defaultValue={Number.isInteger(maquinaFiltro) && maquinaFiltro > 0 ? String(maquinaFiltro) : ""} className={filterInputClass}><option value="">Todas</option>{maquinas.map((maquina) => <option key={maquina.id} value={maquina.id}>{rotuloMaquina(maquina.codigo, maquina.nome)}</option>)}</select></label>
          <label className="block"><span className={filterLabelClass}>Programador</span><select name="operador" defaultValue={Number.isInteger(operadorFiltro) && operadorFiltro > 0 ? String(operadorFiltro) : ""} className={filterInputClass}><option value="">Todos</option>{operadores.map((operador) => <option key={operador.id} value={operador.id}>{operador.nome}</option>)}</select></label>
          <label className="block"><span className={filterLabelClass}>Setor</span><select name="setor" defaultValue={Number.isInteger(setorFiltro) && setorFiltro > 0 ? String(setorFiltro) : ""} className={filterInputClass}><option value="">Todos</option>{setores.map((setor) => <option key={setor.id} value={setor.id}>{setor.nome}</option>)}</select></label>
          <DateFilter name="dataInicio" label="Data inicial" defaultValue={dataInicio} inputClassName={filterInputClass} />
          <DateFilter name="dataFim" label="Data final" defaultValue={dataFim} inputClassName={filterInputClass} />
          <button type="submit" className="rounded bg-cyan-400 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-950 transition hover:bg-cyan-300">Buscar</button>
          {buscaDetalhada && <Link href="/plasma" className="rounded border border-slate-600 px-3 py-1.5 text-center text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Limpar</Link>}
          {buscaDetalhada && !periodoInvalido && <input type="hidden" name="pagina" value="1" />}
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/80 px-3 py-2 text-[10px] text-slate-500">
          <p>{periodoInvalido ? <span className="text-amber-200">A data inicial precisa ser anterior ou igual à data final.</span> : buscaDetalhada ? "Busca detalhada ativada: os resultados exibem a última movimentação e os operadores envolvidos." : "Use a busca para abrir uma visão mais completa da rastreabilidade do NEST."} {totalNests} resultado(s).</p>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold uppercase tracking-wider text-slate-600">Atalhos:</span>
            <Link href={periodoRapido(0)} className="rounded border border-slate-700 px-2 py-1 font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Hoje</Link>
            <Link href={periodoRapido(1)} className="rounded border border-slate-700 px-2 py-1 font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">Ontem</Link>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-[#202a36] shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-100">NESTS DE PLASMA</h3>
            <p className="mt-0.5 text-xs text-slate-500">Lista compacta para a operação; clique em qualquer linha para ver a rastreabilidade completa.</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Página {paginaAtual} de {totalPaginas}</span>
        </div>

        {!nests.length ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-300">Nenhum NEST encontrado.</p>
            <p className="mt-1 text-xs text-slate-500">Ajuste os filtros ou crie uma nova programação.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/70">
            {nests.map((nest) => {
              const lancamentos = nest.itens.flatMap((item) => item.lancamentos).sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
              const eventos = [...nest.eventos].sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
              const declaradas = lancamentos.reduce((total, item) => total + item.quantidadeBoa, 0);
              const boas = lancamentos.reduce((total, item) => total + boasConferidas(item), 0);
              const perdas = lancamentos.reduce((total, item) => total + perdasEfetivas(item), 0);
              const pendentesConferenciaNest = lancamentos.filter(item => item.apontamentoId === null).length;
              const planejado = nest.itens.reduce((total, item) => total + item.quantidadePlanejada, 0);
              const ops = [...new Set(nest.itens.map((item) => item.op.lote ?? item.op.modelo.codigo))];
              const apontadores = [...new Set(lancamentos.map((item) => item.funcionario.nome))];
              const ultimoLancamento = lancamentos[0];
              const ultimoEvento = eventos[0];
              const pecasResumo = nest.itens.map((item) => `${item.peca.codigo} (${item.quantidadePlanejada})`).join(" · ");
              return (
                <Link key={nest.id} href={`/plasma/${nest.id}`} className="group block px-4 py-2.5 transition hover:bg-slate-800/45">
                  <div className="grid gap-x-4 gap-y-2 md:grid-cols-[minmax(11rem,1.1fr)_minmax(11rem,1fr)_minmax(14rem,2fr)_minmax(13rem,1.2fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold tracking-wide text-white">{nest.codigo}</span>
                        <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${pendentesConferenciaNest && nest.status === "CONCLUIDO" ? statusClass.PAUSADO : statusClass[nest.status] ?? statusClass.PROGRAMADO}`}>{pendentesConferenciaNest && nest.status === "CONCLUIDO" ? "Aguardando conferência" : statusLabel[nest.status] ?? nest.status}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{nest.setor.nome}</p>
                    </div>

                    <div className="min-w-0">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Máquina</p>
                      <p className="truncate text-xs font-medium text-slate-200" title={rotuloMaquina(nest.maquina.codigo, nest.maquina.nome)}>
                        {rotuloMaquina(nest.maquina.codigo, nest.maquina.nome)}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Peças programadas</p>
                      <p className="truncate text-xs text-slate-300" title={pecasResumo}>{pecasResumo}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span><span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Declaradas </span><strong className="text-sky-200">{numero(declaradas)}</strong><span className="text-slate-500">/{numero(planejado)}</span></span>
                      <span><span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Liberadas </span><strong className="text-emerald-200">{numero(boas)}</strong></span>
                      {pendentesConferenciaNest > 0 && <span><strong className="text-amber-200">{pendentesConferenciaNest} conferência(ões)</strong></span>}
                      {perdas > 0 && <span><span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Perdas </span><strong className="text-rose-200">{numero(perdas)}</strong></span>}
                    </div>

                    <span className="text-left text-xs font-semibold text-cyan-200 transition group-hover:translate-x-0.5 md:text-right">Detalhes →</span>
                  </div>

                  <p className="mt-1 truncate text-[10px] text-slate-600">OPs: {ops.join(", ")} · {nest.itens.length} peça(s) · Programado por {nest.programador.nome}</p>
                  {buscaDetalhada && (
                    <div className="mt-2 grid gap-1 border-t border-slate-700/60 pt-2 text-[10px] text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
                      <span>Último apontamento: <strong className="font-medium text-cyan-200">{ultimoLancamento ? `${ultimoLancamento.funcionario.nome} · ${dataHora(ultimoLancamento.dataHora)}` : "Nenhum"}</strong></span>
                      <span>Último evento: <strong className="font-medium text-slate-300">{ultimoEvento ? `${eventoLabel[ultimoEvento.tipo] ?? ultimoEvento.tipo} · ${dataHora(ultimoEvento.dataHora)}` : "Nenhum"}</strong></span>
                      <span>Chapa: <strong className="font-medium text-slate-300">{nest.espessuraMm === null ? "-" : `${nest.espessuraMm.toLocaleString("pt-BR")} mm`}</strong></span>
                      <span>Tempo de corte: <strong className="font-medium text-slate-300">{tempo(nest.tempoCorteSegundos)}</strong>{apontadores.length > 0 ? ` · ${apontadores.join(", ")}` : ""}</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {totalPaginas > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/80 px-4 py-3">
            <span className="text-xs text-slate-500">{totalNests} NEST(s) encontrados</span>
            <div className="flex gap-2">
              <Link href={hrefPagina(Math.max(1, paginaAtual - 1))} className={`rounded border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100 ${paginaAtual <= 1 ? "pointer-events-none opacity-40" : ""}`}>Anterior</Link>
              <Link href={hrefPagina(Math.min(totalPaginas, paginaAtual + 1))} className={`rounded border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100 ${paginaAtual >= totalPaginas ? "pointer-events-none opacity-40" : ""}`}>Próxima</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Indicador({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) {
  return <div className="rounded-lg border border-white/5 bg-[#101925]/70 px-3 py-2.5"><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{rotulo}</p><p className={`mt-1 text-lg font-bold ${cor}`}>{valor}</p></div>;
}

const filterLabelClass = "mb-1 block font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500";
const filterInputClass = "w-full rounded border border-slate-700 bg-[#111925] px-2.5 py-1.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30";
