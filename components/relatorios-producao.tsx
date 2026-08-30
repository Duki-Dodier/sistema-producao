"use client";

import { FileDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TIPO_LABEL } from "@/lib/labels";

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
  origem: string;
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

export type ModeloEngateRelatorio = {
  id: number;
  codigo: string;
  nome: string | null;
  curva: string;
  tipo: string;
  tamanhoPonteira: string | null;
  estoqueMinimo: number | null;
  linhaProduto: string;
};

export type CapacidadeSetorRelatorio = {
  setorNome: string;
  fila: number;
  produzidaHoje: number;
  tempoMedioSegundos: number | null;
  capacidadeEstimada: number | null;
  gargalo: string;
  maquinaMaisUsada: string;
};

export function RelatoriosProducao({
  registros,
  produtos,
  processosAtivos,
  modelosEngate,
  capacidadeSetores,
}: {
  registros: RegistroRelatorio[];
  produtos: ProdutoRelatorio[];
  processosAtivos: ProcessoAtivoRelatorio[];
  modelosEngate: ModeloEngateRelatorio[];
  capacidadeSetores: CapacidadeSetorRelatorio[];
}) {
  const [busca, setBusca] = useState("");
  const [operador, setOperador] = useState("");
  const [maquina, setMaquina] = useState("");
  const [setor, setSetor] = useState("");
  const [codigoPrincipal, setCodigoPrincipal] = useState("");
  const [operadorRelatorio, setOperadorRelatorio] = useState("");
  const [statusOP, setStatusOP] = useState("");
  const [modeloEngateId, setModeloEngateId] = useState("");
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioDoMes = `${hoje.slice(0, 8)}01`;
  const [dataInicio, setDataInicio] = useState(inicioDoMes);
  const [dataFim, setDataFim] = useState(hoje);
  const [agora, setAgora] = useState(0);

  useEffect(() => {
    const atualizar = () => setAgora(Date.now());
    atualizar();
    const timer = window.setInterval(atualizar, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const opcoes = useMemo(() => ({
    produtos: [...new Set(produtos.map((item) => item.modeloCodigo))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    operadores: [...new Set(registros.map((item) => item.usuario))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    maquinas: [...new Set(registros.map((item) => item.maquinaCodigo).filter((item): item is string => Boolean(item)))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    setores: [...new Set(registros.map((item) => item.setorNome))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  }), [produtos, registros]);

  const hrefPdf = useMemo(() => {
    const parametros = new URLSearchParams();
    if (codigoPrincipal) parametros.set("produto", codigoPrincipal);
    if (operadorRelatorio) parametros.set("operador", operadorRelatorio);
    if (dataInicio) parametros.set("inicio", dataInicio);
    if (dataFim) parametros.set("fim", dataFim);
    if (statusOP) parametros.set("status", statusOP);
    return `/relatorios/pdf?${parametros.toString()}`;
  }, [codigoPrincipal, dataFim, dataInicio, operadorRelatorio, statusOP]);

  const hrefCsv = useMemo(() => `${hrefPdf.replace("/relatorios/pdf", "/relatorios/csv")}`, [hrefPdf]);

  const periodoValido = Boolean(dataInicio && dataFim && dataInicio <= dataFim);

  const modeloEngateSelecionado = useMemo(
    () => modelosEngate.find((modelo) => String(modelo.id) === modeloEngateId) ?? null,
    [modeloEngateId, modelosEngate],
  );

  const hrefFichaEngate = modeloEngateSelecionado
    ? `/relatorios/engate/pdf?modeloId=${modeloEngateSelecionado.id}`
    : "#";

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
    const inicioMs = dataInicio ? new Date(`${dataInicio}T00:00:00`).getTime() : null;
    const fimMs = dataFim ? new Date(`${dataFim}T23:59:59`).getTime() : null;
    return produtos.filter((produto) => opIds.has(produto.opId) && (!statusOP || produto.status === statusOP) && (inicioMs === null || new Date(produto.inicio).getTime() >= inicioMs) && (fimMs === null || new Date(produto.inicio).getTime() <= fimMs));
  }, [dataFim, dataInicio, produtos, registrosFiltrados, statusOP]);

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

  const resumoProduto = useMemo(() => {
    if (!codigoPrincipal) return null;
    const inicioMs = dataInicio ? new Date(`${dataInicio}T00:00:00`).getTime() : null;
    const fimMs = dataFim ? new Date(`${dataFim}T23:59:59`).getTime() : null;
    const ops = produtos
      .filter((produto) => produto.modeloCodigo === codigoPrincipal && (!statusOP || produto.status === statusOP) && (inicioMs === null || new Date(produto.inicio).getTime() >= inicioMs) && (fimMs === null || new Date(produto.inicio).getTime() <= fimMs))
      .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());
    const opIds = new Set(ops.map((op) => op.opId));
    const registrosDoProduto = registros.filter((registro) => registro.modeloCodigo === codigoPrincipal && opIds.has(registro.opId) && (inicioMs === null || new Date(registro.dataHora).getTime() >= inicioMs) && (fimMs === null || new Date(registro.dataHora).getTime() <= fimMs));
    const pecasMap = new Map<string, {
      pecaCodigo: string;
      pecaNome: string;
      setorNome: string;
      tempoSegundos: number;
      quantidade: number;
      ops: Set<number>;
    }>();
    for (const registro of registrosDoProduto) {
      if (!registro.pecaCodigo || !registro.pecaNome) continue;
      const chave = `${registro.pecaCodigo}-${registro.setorNome}`;
      const atual = pecasMap.get(chave) ?? {
        pecaCodigo: registro.pecaCodigo,
        pecaNome: registro.pecaNome,
        setorNome: registro.setorNome,
        tempoSegundos: 0,
        quantidade: 0,
        ops: new Set<number>(),
      };
      atual.tempoSegundos += registro.tempoSegundos ?? 0;
      atual.quantidade += registro.quantidadeBoa;
      atual.ops.add(registro.opId);
      pecasMap.set(chave, atual);
    }
    const pecas = [...pecasMap.values()].sort((a, b) => a.pecaNome.localeCompare(b.pecaNome, "pt-BR"));
    const ultimasOps = ops.slice(0, 3).map((op) => {
      const registrosDaOp = registrosDoProduto.filter((registro) => registro.opId === op.opId);
      return {
        ...op,
        tempoPecas: registrosDaOp.reduce((total, registro) => total + (registro.tempoSegundos ?? 0), 0),
        quantidadeApontada: registrosDaOp.reduce((total, registro) => total + registro.quantidadeBoa, 0),
      };
    });
    const tempoPecas = registrosDoProduto.reduce((total, registro) => total + (registro.tempoSegundos ?? 0), 0);
    const quantidadeApontada = registrosDoProduto.reduce((total, registro) => total + registro.quantidadeBoa, 0);
    return {
      ops,
      ultimasOps,
      pecas,
      tempoTotal: ops.reduce((total, op) => total + op.tempoOPSegundos, 0),
      tempoMedioOP: media(ops.map((op) => op.tempoOPSegundos)),
      tempoMedioUltimas3: media(ultimasOps.map((op) => op.tempoOPSegundos)),
      tempoPecas,
      tempoMedioPeca: media(pecas.map((peca) => peca.tempoSegundos)),
      tempoPorUnidade: quantidadeApontada > 0 ? tempoPecas / quantidadeApontada : 0,
      quantidadePlanejada: ops.reduce((total, op) => total + op.quantidade, 0),
      quantidadeApontada,
      concluidas: ops.filter((op) => op.status === "CONCLUIDA").length,
      maquinas: [...new Set(registrosDoProduto.map((registro) => registro.maquinaCodigo).filter(Boolean))].join(", "),
      setores: [...new Set(registrosDoProduto.map((registro) => registro.setorNome))].join(", "),
    };
  }, [codigoPrincipal, dataFim, dataInicio, produtos, registros, statusOP]);

  const resumoOperador = useMemo(() => {
    if (!operadorRelatorio) return null;
    const inicioMs = dataInicio ? new Date(`${dataInicio}T00:00:00`).getTime() : null;
    const fimMs = dataFim ? new Date(`${dataFim}T23:59:59`).getTime() : null;
    const opsPermitidas = new Set(produtos.filter((produto) => (!statusOP || produto.status === statusOP) && (inicioMs === null || new Date(produto.inicio).getTime() >= inicioMs) && (fimMs === null || new Date(produto.inicio).getTime() <= fimMs)).map((produto) => produto.opId));
    const registrosDoOperador = registros.filter((registro) => registro.usuario === operadorRelatorio && opsPermitidas.has(registro.opId) && (inicioMs === null || new Date(registro.dataHora).getTime() >= inicioMs) && (fimMs === null || new Date(registro.dataHora).getTime() <= fimMs));
    const opsMap = new Map<number, { opNumero: number; modeloCodigo: string; tempoSegundos: number; quantidade: number; ultimaData: string }>();
    for (const registro of registrosDoOperador) {
      const atual = opsMap.get(registro.opId) ?? {
        opNumero: registro.opNumero,
        modeloCodigo: registro.modeloCodigo,
        tempoSegundos: 0,
        quantidade: 0,
        ultimaData: registro.dataHora,
      };
      atual.tempoSegundos += registro.tempoSegundos ?? 0;
      atual.quantidade += registro.quantidadeBoa;
      if (new Date(registro.dataHora).getTime() > new Date(atual.ultimaData).getTime()) atual.ultimaData = registro.dataHora;
      opsMap.set(registro.opId, atual);
    }
    const ultimasOps = [...opsMap.values()].sort((a, b) => new Date(b.ultimaData).getTime() - new Date(a.ultimaData).getTime()).slice(0, 3);
    const pecasMap = new Map<string, number>();
    for (const registro of registrosDoOperador) {
      if (!registro.pecaCodigo) continue;
      const chave = `${registro.pecaCodigo} · ${registro.pecaNome ?? "Peça"}`;
      pecasMap.set(chave, (pecasMap.get(chave) ?? 0) + (registro.tempoSegundos ?? 0));
    }
    const tempoTotal = registrosDoOperador.reduce((total, registro) => total + (registro.tempoSegundos ?? 0), 0);
    const quantidade = registrosDoOperador.reduce((total, registro) => total + registro.quantidadeBoa, 0);
    return {
      registros: registrosDoOperador.length,
      ops: opsMap.size,
      quantidade,
      tempoTotal,
      tempoMedioOP: media([...opsMap.values()].map((op) => op.tempoSegundos)),
      tempoMedioUltimas3: media(ultimasOps.map((op) => op.tempoSegundos)),
      tempoMedioPeca: media([...pecasMap.values()]),
      tempoPorUnidade: quantidade > 0 ? tempoTotal / quantidade : 0,
      ultimasOps,
      maquinas: [...new Set(registrosDoOperador.map((registro) => registro.maquinaCodigo).filter(Boolean))].join(", "),
      setores: [...new Set(registrosDoOperador.map((registro) => registro.setorNome))].join(", "),
    };
  }, [dataFim, dataInicio, operadorRelatorio, produtos, registros, statusOP]);

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-xl border border-violet-400/25 bg-[#131b2e]">
        <SectionTitle title="Capacidade dos setores" subtitle="Visão diária de fila, produção, tempo médio, capacidade estimada e gargalos." />
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-3">Setor</th><th className="px-4 py-3">Em fila</th><th className="px-4 py-3">Produzida hoje</th><th className="px-4 py-3">Tempo médio</th><th className="px-4 py-3">Capacidade estimada/dia</th><th className="px-4 py-3">Gargalo atual</th><th className="px-4 py-3">Máquina mais usada</th></tr></thead><tbody>{capacidadeSetores.map((item) => <tr key={item.setorNome} className="border-b border-white/5 last:border-0"><td className="px-4 py-3 font-semibold text-white">{item.setorNome}</td><td className={`px-4 py-3 font-mono ${item.fila > 0 ? "text-amber-200" : "text-slate-400"}`}>{item.fila}</td><td className="px-4 py-3 font-mono text-emerald-300">{item.produzidaHoje}</td><td className="px-4 py-3 font-mono text-cyan-200">{item.tempoMedioSegundos === null ? "—" : formatDuracao(item.tempoMedioSegundos)}</td><td className="px-4 py-3 font-mono text-violet-200">{item.capacidadeEstimada === null ? "—" : item.capacidadeEstimada.toFixed(1)}</td><td className={`px-4 py-3 text-xs ${item.fila > 0 ? "text-amber-200" : "text-emerald-300"}`}>{item.gargalo}</td><td className="px-4 py-3 font-mono text-slate-300">{item.maquinaMaisUsada}</td></tr>)}</tbody></table></div>
      </section>
      <section className="overflow-hidden rounded-xl border border-emerald-400/25 bg-[#131b2e]">
        <SectionTitle
          title="Ficha completa do engate"
          subtitle="Emita um PDF com os dados técnicos, materiais, roteiro e histórico de produção do modelo."
        />
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">Engate / modelo</span>
            <select
              value={modeloEngateId}
              onChange={(event) => setModeloEngateId(event.target.value)}
              className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-emerald-300"
            >
              <option value="">Escolha o código do engate...</option>
              {modelosEngate.map((modelo) => (
                <option key={modelo.id} value={modelo.id}>
                  {modelo.codigo} · {modelo.nome ?? "Sem descrição"}
                </option>
              ))}
            </select>
          </label>
          {modeloEngateSelecionado ? (
            <a
              href={hrefFichaEngate}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <FileDown className="h-4 w-4" />
              Emitir ficha em PDF
            </a>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-3 text-sm font-bold text-slate-400">
              <FileDown className="h-4 w-4" />
              Selecione um engate
            </span>
          )}
        </div>
        {modeloEngateSelecionado && (
          <div className="grid gap-3 border-t border-white/10 bg-[#10182a] p-4 sm:grid-cols-2 xl:grid-cols-6">
            <FichaResumo label="Código" value={modeloEngateSelecionado.codigo} />
            <FichaResumo label="Descrição" value={modeloEngateSelecionado.nome ?? "Não informada"} />
            <FichaResumo label="Tipo" value={TIPO_LABEL[modeloEngateSelecionado.tipo] ?? modeloEngateSelecionado.tipo} />
            <FichaResumo label="Curva ABC" value={modeloEngateSelecionado.curva || "Não informada"} />
            <FichaResumo label="Estoque regulador" value={modeloEngateSelecionado.estoqueMinimo === null ? "Não informado" : String(modeloEngateSelecionado.estoqueMinimo)} />
            <FichaResumo label="Ponteira" value={modeloEngateSelecionado.tamanhoPonteira ?? "Não se aplica"} />
          </div>
        )}
      </section>
      <section className="overflow-hidden rounded-xl border border-cyan-400/25 bg-[#131b2e]">
        <SectionTitle title="Gerar relatório por produto ou operador" subtitle="Escolha um código principal ou um operador para consultar médias, últimas OPs e produtividade." />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300">Produto principal</span>
            <select value={codigoPrincipal} onChange={(event) => setCodigoPrincipal(event.target.value)} className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-cyan-300">
              <option value="">Escolha o código do produto, ex.: BM1000</option>
              {opcoes.produtos.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">Operador</span>
            <select value={operadorRelatorio} onChange={(event) => setOperadorRelatorio(event.target.value)} className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-emerald-300">
              <option value="">Escolha o operador</option>
              {opcoes.operadores.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">Data inicial</span>
              <input
                type="date"
                value={dataInicio}
                max={dataFim || undefined}
                onChange={(event) => setDataInicio(event.target.value)}
                className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-amber-300"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">Data final</span>
              <input
                type="date"
                value={dataFim}
                min={dataInicio || undefined}
                max={hoje}
                onChange={(event) => setDataFim(event.target.value)}
                className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-amber-300"
              />
            </label>
          </div>
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-violet-300">Status da OP</span>
            <select value={statusOP} onChange={(event) => setStatusOP(event.target.value)} className="rounded-lg border border-[#3d494c] bg-[#060e20] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-violet-300"><option value="">Todos os status</option><option value="ABERTA">Abertas</option><option value="CONCLUIDA">Concluídas</option><option value="CANCELADA">Canceladas</option></select>
          </label>
        </div>

        <div className="flex items-center justify-end border-t border-white/10 bg-[#10182a] px-4 py-3">
          {(codigoPrincipal || operadorRelatorio) && periodoValido ? (
            <div className="flex flex-wrap justify-end gap-2">
              <a
                href={hrefPdf}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                <FileDown className="h-4 w-4" />
                Gerar PDF completo
              </a>
              <a href={hrefCsv} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/40 px-4 py-2.5 text-sm font-bold text-cyan-200 hover:bg-cyan-400/10">Exportar CSV</a>
            </div>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-bold text-slate-400">
              <FileDown className="h-4 w-4" />
              Selecione um filtro e o período para gerar o PDF
            </span>
          )}
        </div>

        {resumoProduto && (
          <div className="border-t border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300">Relatório do produto principal</div>
                <h2 className="mt-1 text-xl font-bold text-white">{codigoPrincipal}</h2>
              </div>
              <div className="text-right text-xs text-slate-400">{resumoProduto.ops.length} OP(s) analisada(s)<br />{resumoProduto.setores || "Setor ainda não informado"}</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Kpi label="Tempo total das OPs" value={formatDuracao(resumoProduto.tempoTotal)} tone="cyan" />
              <Kpi label="Média por OP" value={formatDuracao(resumoProduto.tempoMedioOP)} tone="cyan" />
              <Kpi label="Média últimas 3 OPs" value={formatDuracao(resumoProduto.tempoMedioUltimas3)} tone="amber" />
              <Kpi label="Média das peças" value={formatDuracao(resumoProduto.tempoMedioPeca)} tone="amber" />
              <Kpi label="Tempo por unidade" value={formatDuracao(resumoProduto.tempoPorUnidade)} tone="emerald" />
              <Kpi label="OPs concluídas" value={`${resumoProduto.concluidas}/${resumoProduto.ops.length}`} tone="neutral" />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1326]">
                <div className="border-b border-white/10 px-4 py-3"><h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">Últimas 3 OPs</h3><p className="mt-1 text-xs text-slate-500">A média acima é calculada pelo tempo completo de cada uma.</p></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase text-slate-500"><th className="px-4 py-3">OP</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Tempo da OP</th><th className="px-4 py-3">Tempo das peças</th></tr></thead><tbody>{resumoProduto.ultimasOps.map((op) => <tr key={op.opId} className="border-b border-white/5 last:border-0"><td className="px-4 py-3 font-mono text-cyan-300">OP {op.opNumero}<div className="text-[11px] text-slate-500">{op.lote ?? "Sem lote"}</div></td><td className="px-4 py-3 text-xs text-slate-300">{op.status === "CONCLUIDA" ? "Concluída" : "Em produção"}</td><td className="px-4 py-3 font-mono text-cyan-200">{formatDuracao(op.tempoOPSegundos)}</td><td className="px-4 py-3 font-mono text-amber-200">{formatDuracao(op.tempoPecas)}</td></tr>)}</tbody></table></div>
              </div>
              <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1326]">
                <div className="border-b border-white/10 px-4 py-3"><h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">Peças do produto</h3><p className="mt-1 text-xs text-slate-500">Tempo médio por peça/OP e tempo aproximado por unidade.</p></div>
                <div className="max-h-72 overflow-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase text-slate-500"><th className="px-4 py-3">Peça</th><th className="px-4 py-3">Setor</th><th className="px-4 py-3">Média peça/OP</th><th className="px-4 py-3">Quantidade</th></tr></thead><tbody>{resumoProduto.pecas.map((peca) => <tr key={`${peca.pecaCodigo}-${peca.setorNome}`} className="border-b border-white/5 last:border-0"><td className="px-4 py-3"><div className="font-semibold text-white">{peca.pecaCodigo}</div><div className="text-xs text-slate-400">{peca.pecaNome}</div></td><td className="px-4 py-3 text-xs text-slate-400">{peca.setorNome}</td><td className="px-4 py-3 font-mono text-amber-200">{formatDuracao(peca.tempoSegundos / peca.ops.size)}</td><td className="px-4 py-3 text-emerald-300">{peca.quantidade}</td></tr>)}</tbody></table></div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Máquinas utilizadas: {resumoProduto.maquinas || "ainda não informadas"}.</p>
          </div>
        )}

        {resumoOperador && (
          <div className="border-t border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">Relatório do operador</div><h2 className="mt-1 text-xl font-bold text-white">{operadorRelatorio}</h2></div>
              <div className="text-right text-xs text-slate-400">{resumoOperador.ops} OP(s) · {resumoOperador.registros} lançamento(s)<br />{resumoOperador.setores || "Setor ainda não informado"}</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Kpi label="Tempo total" value={formatDuracao(resumoOperador.tempoTotal)} tone="emerald" />
              <Kpi label="Média por OP" value={formatDuracao(resumoOperador.tempoMedioOP)} tone="cyan" />
              <Kpi label="Média últimas 3 OPs" value={formatDuracao(resumoOperador.tempoMedioUltimas3)} tone="amber" />
              <Kpi label="Média por peça" value={formatDuracao(resumoOperador.tempoMedioPeca)} tone="amber" />
              <Kpi label="Tempo por unidade" value={formatDuracao(resumoOperador.tempoPorUnidade)} tone="emerald" />
              <Kpi label="Quantidade produzida" value={String(resumoOperador.quantidade)} tone="neutral" />
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-[#0b1326]">
              <div className="border-b border-white/10 px-4 py-3"><h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">Últimas 3 OPs do operador</h3><p className="mt-1 text-xs text-slate-500">Tempo acumulado dos lançamentos feitos em cada OP.</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-white/10 font-mono text-[10px] uppercase text-slate-500"><th className="px-4 py-3">OP</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Tempo</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Último lançamento</th></tr></thead><tbody>{resumoOperador.ultimasOps.map((op) => <tr key={`${op.opNumero}-${op.modeloCodigo}-${op.ultimaData}`} className="border-b border-white/5 last:border-0"><td className="px-4 py-3 font-mono text-cyan-300">OP {op.opNumero}</td><td className="px-4 py-3 text-slate-200">{op.modeloCodigo}</td><td className="px-4 py-3 font-mono text-amber-200">{formatDuracao(op.tempoSegundos)}</td><td className="px-4 py-3 text-emerald-300">{op.quantidade}</td><td className="px-4 py-3 text-xs text-slate-400">{formatData(op.ultimaData)}</td></tr>)}</tbody></table></div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Máquinas utilizadas: {resumoOperador.maquinas || "ainda não informadas"}.</p>
          </div>
        )}

        {!resumoProduto && !resumoOperador && <p className="border-t border-white/10 px-4 py-5 text-sm text-slate-500">Escolha um produto ou operador para gerar o relatório detalhado.</p>}
      </section>

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
                <td className="px-4 py-3"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-cyan-300">OP {registro.opNumero} · {registro.modeloCodigo}</span>{registro.origem === "TESTE" && <span className="rounded bg-violet-400/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-violet-200">Demonstração</span>}</div><div className="text-xs text-slate-300">{registro.pecaCodigo ? `${registro.pecaCodigo} · ${registro.pecaNome}` : "Produto principal"}</div></td>
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

function FichaResumo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1326] px-3 py-2.5">
      <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-100" title={value}>{value}</div>
    </div>
  );
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

function media(valores: number[]) {
  const validos = valores.filter((valor) => Number.isFinite(valor) && valor > 0);
  return validos.length > 0
    ? Math.round(validos.reduce((total, valor) => total + valor, 0) / validos.length)
    : 0;
}

function formatData(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
}
