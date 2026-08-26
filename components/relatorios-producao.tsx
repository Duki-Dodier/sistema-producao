"use client";

import { useEffect, useMemo, useState } from "react";

export type RegistroRelatorio = {
  id: number;
  opId: number;
  opNumero: number;
  lote: string | null;
  modeloCodigo: string;
  modeloNome: string | null;
  pecaCodigo: string | null;
  pecaNome: string | null;
  setorNome: string;
  processo: string | null;
  usuario: string;
  maquinaCodigo: string | null;
  quantidadeBoa: number;
  tempoSegundos: number | null;
  dataHora: string;
};

export type ProdutoRelatorio = {
  opId: number;
  opNumero: number;
  lote: string | null;
  modeloCodigo: string;
  modeloNome: string | null;
  quantidade: number;
  status: string;
  inicio: string;
  fim: string | null;
  tempoOPSegundos: number;
};

export type ProcessoAtivoRelatorio = {
  id: number;
  opNumero: number;
  modeloCodigo: string;
  pecaNome: string | null;
  setorNome: string;
  usuario: string;
  maquinaCodigo: string;
  iniciadoEm: string;
};

export function RelatoriosProducao({
  registros,
  produtos,
  processosAtivos,
}: {
  registros: RegistroRelatorio[];
  produtos: ProdutoRelatorio[];
  processosAtivos: ProcessoAtivoRelatorio[];
}) {
  const [busca, setBusca] = useState("");
  const [operador, setOperador] = useState("");
  const [maquina, setMaquina] = useState("");
  const [setor, setSetor] = useState("");
  const [agora, setAgora] = useState(0);

  useEffect(() => {
    const atualizar = () => setAgora(Date.now());
    atualizar();
    const timer = window.setInterval(atualizar, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const opcoes = useMemo(() => ({
    operadores: [...new Set(registros.map((item) => item.usuario))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    maquinas: [...new Set(registros.map((item) => item.maquinaCodigo).filter((item): item is string => Boolean(item)))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    setores: [...new Set(registros.map((item) => item.setorNome))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  }), [registros]);

  const registrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return registros.filter((registro) => {
      const texto = [
        registro.opNumero,
        registro.lote,
        registro.modeloCodigo,
        registro.modeloNome,
        registro.pecaCodigo,
        registro.pecaNome,
        registro.usuario,
        registro.maquinaCodigo,
        registro.setorNome,
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      return (!termo || texto.includes(termo)) &&
        (!operador || registro.usuario === operador) &&
        (!maquina || registro.maquinaCodigo === maquina) &&
        (!setor || registro.setorNome === setor);
    });
  }, [busca, maquina, operador, registros, setor]);

  const produtosFiltrados = useMemo(() => {
    const opIds = new Set(registrosFiltrados.map((registro) => registro.opId));
    return produtos.filter((produto) => opIds.has(produto.opId));
  }, [produtos, registrosFiltrados]);

  const pecas = useMemo(() => {
    const grupos = new Map<string, {
      opNumero: number;
      modeloCodigo: string;
      pecaCodigo: string;
      pecaNome: string;
      setorNome: string;
      quantidade: number;
      tempoSegundos: number;
      registros: number;
      operadores: Set<string>;
    }>();
    for (const registro of registrosFiltrados) {
      if (!registro.pecaCodigo || !registro.pecaNome) continue;
      const chave = `${registro.opId}-${registro.pecaCodigo}-${registro.setorNome}`;
      const atual = grupos.get(chave) ?? {
        opNumero: registro.opNumero,
        modeloCodigo: registro.modeloCodigo,
        pecaCodigo: registro.pecaCodigo,
        pecaNome: registro.pecaNome,
        setorNome: registro.setorNome,
        quantidade: 0,
        tempoSegundos: 0,
        registros: 0,
        operadores: new Set<string>(),
      };
      atual.quantidade += registro.quantidadeBoa;
      atual.tempoSegundos += registro.tempoSegundos ?? 0;
      atual.registros += 1;
      atual.operadores.add(registro.usuario);
      grupos.set(chave, atual);
    }
    return [...grupos.values()].sort((a, b) => a.opNumero - b.opNumero || a.pecaNome.localeCompare(b.pecaNome, "pt-BR"));
  }, [registrosFiltrados]);

  const tempoTotal = registrosFiltrados.reduce((total, item) => total + (item.tempoSegundos ?? 0), 0);
  const quantidadeTotal = registrosFiltrados.reduce((total, item) => total + item.quantidadeBoa, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-[#2d3449] bg-[#131b2e] p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#dae2fd]">Filtros dos relatórios</h2>
            <p className="mt-1 text-xs text-slate-500">Filtre por produto, peça, operador, máquina ou setor.</p>
          </div>
          {(busca || operador || maquina || setor) && (
            <button
              type="button"
              onClick={() => { setBusca(""); setOperador(""); setMaquina(""); setSetor(""); }}
              className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300 hover:text-white"
            >
              Limpar filtros
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="OP, modelo, peça..."
            className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300"
          />
          <select value={operador} onChange={(event) => setOperador(event.target.value)} className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300">
            <option value="">Todos os operadores</option>
            {opcoes.operadores.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={maquina} onChange={(event) => setMaquina(event.target.value)} className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300">
            <option value="">Todas as máquinas</option>
            {opcoes.maquinas.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={setor} onChange={(event) => setSetor(event.target.value)} className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300">
            <option value="">Todos os setores</option>
            {opcoes.setores.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="OPs acompanhadas" value={String(produtosFiltrados.length)} tone="cyan" />
        <Kpi label="Peças apontadas" value={String(quantidadeTotal)} tone="emerald" />
        <Kpi label="Tempo registrado" value={formatDuracao(tempoTotal)} tone="amber" />
        <Kpi label="Processos em andamento" value={String(processosAtivos.length)} tone={processosAtivos.length > 0 ? "orange" : "neutral"} />
      </div>

      {processosAtivos.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-amber-400/25 bg-[#131b2e]">
          <SectionTitle title="Processos em andamento agora" subtitle="O tempo continua contando até o operador finalizar o apontamento." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">OP / produto</th><th className="px-4 py-3">Peça</th><th className="px-4 py-3">Setor</th><th className="px-4 py-3">Operador</th><th className="px-4 py-3">Máquina</th><th className="px-4 py-3">Tempo</th>
              </tr></thead>
              <tbody>{processosAtivos.map((item) => (
                <tr key={item.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3"><div className="font-mono text-cyan-300">OP {item.opNumero} · {item.modeloCodigo}</div></td>
                  <td className="px-4 py-3 text-slate-200">{item.pecaNome ?? "Produto principal"}</td>
                  <td className="px-4 py-3 text-slate-400">{item.setorNome}</td>
                  <td className="px-4 py-3 text-slate-200">{item.usuario}</td>
                  <td className="px-4 py-3 font-mono text-amber-200">{item.maquinaCodigo}</td>
                  <td className="px-4 py-3 font-mono text-amber-200">{formatDuracao(agora ? Math.max(0, Math.floor((agora - new Date(item.iniciadoEm).getTime()) / 1000)) : 0)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-[#2d3449] bg-[#131b2e]">
        <SectionTitle title="Tempo dos produtos principais" subtitle="Uma linha por ordem de produção, com o tempo total da OP e o tempo registrado nas peças." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">OP</th><th className="px-4 py-3">Produto principal</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Tempo da OP</th><th className="px-4 py-3">Tempo das peças</th><th className="px-4 py-3">Registros</th>
            </tr></thead>
            <tbody>{produtosFiltrados.map((produto) => {
              const registrosDaOp = registrosFiltrados.filter((item) => item.opId === produto.opId);
              const tempoPecas = registrosDaOp.reduce((total, item) => total + (item.tempoSegundos ?? 0), 0);
              return (
                <tr key={produto.opId} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3"><div className="font-mono text-cyan-300">OP {produto.opNumero}</div><div className="text-[11px] text-slate-500">{produto.lote ?? "Sem lote"}</div></td>
                  <td className="px-4 py-3"><div className="font-semibold text-white">{produto.modeloCodigo}</div><div className="text-xs text-slate-400">{produto.modeloNome ?? "Produto principal"} · {produto.quantidade} un.</div></td>
                  <td className="px-4 py-3"><span className={`rounded px-2 py-1 font-mono text-[10px] font-bold uppercase ${produto.status === "CONCLUIDA" ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"}`}>{produto.status === "CONCLUIDA" ? "Concluída" : "Em produção"}</span></td>
                  <td className="px-4 py-3 font-mono text-cyan-200">{formatDuracao(produto.tempoOPSegundos)}</td>
                  <td className="px-4 py-3 font-mono text-amber-200">{formatDuracao(tempoPecas)}</td>
                  <td className="px-4 py-3 text-slate-300">{registrosDaOp.length}</td>
                </tr>
              );
            })}</tbody>
          </table>
          {produtosFiltrados.length === 0 && <Empty text="Nenhum produto encontrado com esses filtros." />}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#2d3449] bg-[#131b2e]">
        <SectionTitle title="Tempo de cada peça" subtitle="Consolidado por OP, peça e setor, com quantidade, operadores e tempo efetivamente registrado." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">OP / produto</th><th className="px-4 py-3">Peça</th><th className="px-4 py-3">Setor</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Tempo</th><th className="px-4 py-3">Operadores</th>
            </tr></thead>
            <tbody>{pecas.map((peca) => (
              <tr key={`${peca.opNumero}-${peca.pecaCodigo}-${peca.setorNome}`} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 font-mono text-cyan-300">OP {peca.opNumero} · {peca.modeloCodigo}</td>
                <td className="px-4 py-3"><div className="font-semibold text-white">{peca.pecaCodigo}</div><div className="text-xs text-slate-400">{peca.pecaNome}</div></td>
                <td className="px-4 py-3 text-slate-400">{peca.setorNome}</td>
                <td className="px-4 py-3 text-emerald-300">{peca.quantidade}</td>
                <td className="px-4 py-3 font-mono text-amber-200">{formatDuracao(peca.tempoSegundos)}</td>
                <td className="px-4 py-3 text-xs text-slate-300">{[...peca.operadores].join(", ")}</td>
              </tr>
            ))}</tbody>
          </table>
          {pecas.length === 0 && <Empty text="Nenhuma peça com tempo registrado foi encontrada." />}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#2d3449] bg-[#131b2e]">
        <SectionTitle title="Lançamentos detalhados" subtitle={`${registrosFiltrados.length} registro(s) encontrados`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Data</th><th className="px-4 py-3">OP / peça</th><th className="px-4 py-3">Processo</th><th className="px-4 py-3">Operador</th><th className="px-4 py-3">Máquina</th><th className="px-4 py-3">Tempo</th><th className="px-4 py-3">Quantidade</th>
            </tr></thead>
            <tbody>{registrosFiltrados.map((registro) => (
              <tr key={registro.id} className="border-b border-white/5 last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{formatData(registro.dataHora)}</td>
                <td className="px-4 py-3"><div className="font-mono text-cyan-300">OP {registro.opNumero} · {registro.modeloCodigo}</div><div className="text-xs text-slate-300">{registro.pecaCodigo ? `${registro.pecaCodigo} · ${registro.pecaNome}` : "Produto principal"}</div></td>
                <td className="px-4 py-3 text-slate-400">{registro.processo ?? "Produção"}</td>
                <td className="px-4 py-3 text-slate-200">{registro.usuario}</td>
                <td className="px-4 py-3 font-mono text-amber-200">{registro.maquinaCodigo ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-amber-200">{formatDuracao(registro.tempoSegundos)}</td>
                <td className="px-4 py-3 text-emerald-300">{registro.quantidadeBoa}</td>
              </tr>
            ))}</tbody>
          </table>
          {registrosFiltrados.length === 0 && <Empty text="Nenhum lançamento encontrado com esses filtros." />}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="border-b border-white/10 bg-[#172238] px-4 py-3"><h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#dae2fd]">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-500">{text}</p>;
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "cyan" | "emerald" | "amber" | "orange" | "neutral" }) {
  const classes = {
    cyan: "border-cyan-400/20 bg-cyan-400/5 text-cyan-200",
    emerald: "border-emerald-400/20 bg-emerald-400/5 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-400/5 text-amber-200",
    orange: "border-orange-400/20 bg-orange-400/5 text-orange-200",
    neutral: "border-slate-700 bg-slate-800/30 text-slate-200",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 ${classes}`}><div className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>;
}

function formatDuracao(segundos: number | null) {
  if (!segundos || segundos <= 0) return "—";
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  if (dias > 0) return `${dias}d ${horas}h ${minutos}min`;
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min ${segundos % 60}s`;
}

function formatData(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
}
