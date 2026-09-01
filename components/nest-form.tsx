"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { ImportadorPdfLibellula } from "@/components/importador-pdf-libellula";
import { criarNestCorte } from "@/lib/actions/nests";
import type { DadosImportadosLibellula } from "@/lib/libellula-pdf";

type Setor = { id: number; nome: string };
type Maquina = { id: number; codigo: string; nome: string; setorId: number };
type OpcaoItem = { referencia: string; setorId: number; opId: number; descricao: string; codigoPeca: string; quantidadePlanejada: number };
type OpcaoOP = { id: number; label: string; itens: OpcaoItem[] };
type Linha = { id: number; referencia: string; quantidade: string; identificacaoPdf?: string };

export function NestForm({
  setores,
  maquinas,
  opcoesOP,
}: {
  setores: Setor[];
  maquinas: Maquina[];
  opcoesOP: OpcaoOP[];
}) {
  type Resultado = { ok: true; mensagem: string } | { ok: false; mensagem: string };
  const [setorId, setSetorId] = useState(setores[0]?.id ?? 0);
  const [maquinaId, setMaquinaId] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([{ id: 1, referencia: "", quantidade: "" }]);
  const [opSelecionadaId, setOpSelecionadaId] = useState("");
  const [opsSelecionadas, setOpsSelecionadas] = useState<number[]>([]);
  const [maquinaImportada, setMaquinaImportada] = useState("");
  const [aviso, setAviso] = useState("");
  const [etapa, setEtapa] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const etapaRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [resultado, acao, pendente] = useActionState<Resultado | null, FormData>(async (_anterior, formData) => {
    try {
      await criarNestCorte(formData);
      return { ok: true, mensagem: "Nest registrado com sucesso. Ele já aparece na lista de rastreabilidade." };
    } catch (erro) {
      return { ok: false, mensagem: erro instanceof Error ? erro.message : "Não foi possível registrar o nest." };
    }
  }, null);
  const maquinasDoSetor = useMemo(() => maquinas.filter((maquina) => maquina.setorId === setorId), [maquinas, setorId]);
  const todasOpcoes = useMemo(() => opcoesOP.flatMap((op) => op.itens), [opcoesOP]);
  const opPorId = useMemo(() => new Map(opcoesOP.map((op) => [op.id, op])), [opcoesOP]);
  const itemPorReferencia = useMemo(() => new Map(todasOpcoes.map((item) => [item.referencia, item])), [todasOpcoes]);
  const opsDoSetor = useMemo(() => opcoesOP.filter((op) => op.itens.some((item) => item.setorId === setorId)), [opcoesOP, setorId]);

  function normalizar(valor: string) {
    return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  }

  function preencherCampo(nome: string, valor: string | number | undefined) {
    if (valor === undefined) return;
    const campo = formRef.current?.elements.namedItem(nome);
    if (campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement || campo instanceof HTMLSelectElement) {
      campo.value = String(valor);
    }
  }

  function importarPdf(dados: DadosImportadosLibellula) {
    const maquina = dados.maquina
      ? maquinas.find((item) => {
          const referencia = normalizar(dados.maquina ?? "");
          return normalizar(`${item.codigo} ${item.nome}`).includes(referencia) || referencia.includes(normalizar(item.codigo));
        })
      : undefined;
    const setorImportado = maquina?.setorId ?? setores.find((setor) => dados.setor === "TUBO" ? setor.nome.toUpperCase().includes("TUBO") : setor.nome.toUpperCase().includes("CHAPA"))?.id ?? setorId;
    if (maquina) {
      setSetorId(maquina.setorId);
      setMaquinaId(String(maquina.id));
    }
    setMaquinaImportada(dados.maquina ?? "");
    if (!maquina && dados.maquina) setAviso(`A máquina "${dados.maquina}" veio no PDF e será cadastrada automaticamente neste setor.`);

    preencherCampo("codigo", dados.codigo);
    preencherCampo("nomeArquivo", dados.nomeArquivo ?? dados.codigo);
    preencherCampo("material", dados.material);
    preencherCampo("espessuraMm", dados.espessuraMm);
    preencherCampo("larguraChapaMm", dados.larguraChapaMm);
    preencherCampo("alturaChapaMm", dados.alturaChapaMm);
    preencherCampo("pesoChapaKg", dados.pesoChapaKg);
    preencherCampo("pesoPecasKg", dados.pesoPecasKg);
    preencherCampo("pesoSobraKg", dados.pesoSobraKg);
    preencherCampo("aproveitamentoPct", dados.aproveitamentoPct);
    preencherCampo("quantidadeChapas", dados.quantidadeChapas);
    preencherCampo("numeroPiercings", dados.numeroPiercings);
    preencherCampo("comprimentoCorteMm", dados.comprimentoCorteMm);
    preencherCampo("comprimentoRapidoMm", dados.comprimentoRapidoMm);
    preencherCampo("tempoCorteSegundos", dados.tempoCorteSegundos);
    preencherCampo("tempoDeslocamentoSegundos", dados.tempoDeslocamentoSegundos);

    if (dados.pecas.length) {
      const novasLinhas = dados.pecas.map((peca, indice) => {
        const candidatas = todasOpcoes.filter((item) => item.setorId === setorImportado && normalizar(item.codigoPeca) === normalizar(peca.codigo));
        return {
          id: indice + 1,
          referencia: candidatas.length === 1 ? candidatas[0].referencia : "",
          quantidade: String(peca.quantidade),
          identificacaoPdf: `${peca.codigo}${peca.descricao ? ` - ${peca.descricao}` : ""}`,
        };
      });
      setLinhas(novasLinhas);
      setOpsSelecionadas([...new Set(novasLinhas.map((linha) => itemPorReferencia.get(linha.referencia)?.opId).filter((id): id is number => Boolean(id)))]);
    }
  }

  function mudarSetor(novoSetorId: number) {
    const haviaPecas = linhas.some((linha) => linha.referencia);
    setSetorId(novoSetorId);
    setMaquinaId("");
    setOpSelecionadaId("");
    setOpsSelecionadas([]);
    setLinhas([{ id: 1, referencia: "", quantidade: "" }]);
    if (haviaPecas) setAviso("As peças escolhidas foram limpas porque o setor foi alterado.");
  }

  function adicionarOp(opIdTexto = opSelecionadaId) {
    const opId = Number(opIdTexto);
    const op = opPorId.get(opId);
    if (!op) {
      setAviso("Escolha uma OP para adicionar ao NEST.");
      return;
    }
    const itensDaOp = op.itens.filter((item) => item.setorId === setorId);
    const referenciasAtuais = new Set(linhas.map((linha) => linha.referencia));
    const novosItens = itensDaOp.filter((item) => !referenciasAtuais.has(item.referencia));
    if (!novosItens.length) {
      setAviso("As peças desta OP já foram adicionadas ao NEST.");
      return;
    }
    const proximoId = Math.max(0, ...linhas.map((linha) => linha.id));
    setOpsSelecionadas((atual) => atual.includes(opId) ? atual : [...atual, opId]);
    setLinhas((atual) => [
      ...atual.filter((linha) => linha.referencia),
      ...novosItens.map((item, indice) => ({ id: proximoId + indice + 1, referencia: item.referencia, quantidade: String(item.quantidadePlanejada) })),
    ]);
    setOpSelecionadaId("");
    setAviso("");
  }

  function adicionarLinhaManual() {
    setLinhas((atual) => [...atual, { id: Math.max(0, ...atual.map((linha) => linha.id)) + 1, referencia: "", quantidade: "" }]);
  }

  function removerLinha(linha: Linha) {
    const novasLinhas = linhas.filter((item) => item.id !== linha.id);
    setLinhas(novasLinhas);
    const opId = itemPorReferencia.get(linha.referencia)?.opId;
    if (opId && !novasLinhas.some((item) => itemPorReferencia.get(item.referencia)?.opId === opId)) {
      setOpsSelecionadas((atual) => atual.filter((id) => id !== opId));
    }
  }

  function renderLinha(linha: Linha, indice: number) {
    const opcao = itemPorReferencia.get(linha.referencia);
    const op = opcao ? opPorId.get(opcao.opId) : undefined;
    return (
      <div key={linha.id} className="grid gap-2 rounded-lg border border-slate-700/70 bg-[#111925]/55 p-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-center">
        {linha.identificacaoPdf && <p className="sm:col-span-3 -mb-1 text-[11px] text-cyan-200">Identificado no PDF: {linha.identificacaoPdf}</p>}
        {opcao ? (
          <>
            <input type="hidden" name="itemRef" value={linha.referencia} />
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{op?.label ?? "OP selecionada"}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{opcao.descricao}</p>
            </div>
          </>
        ) : (
          <select
            name="itemRef"
            required
            className={inputClass}
            value={linha.referencia}
            onChange={(event) => setLinhas((atual) => atual.map((item) => item.id === linha.id ? { ...item, referencia: event.target.value } : item))}
          >
            <option value="">Vincular esta peça a uma OP</option>
            {todasOpcoes.filter((item) => item.setorId === setorId).map((item) => (
              <option key={item.referencia} value={item.referencia}>{opPorId.get(item.opId)?.label} · {item.descricao}</option>
            ))}
          </select>
        )}
        <div>
          <input name="itemQuantidade" type="number" min="1" step="1" required placeholder="Qtd." aria-label={`Quantidade a programar da peça ${indice + 1}`} className={inputClass} value={linha.quantidade} onChange={(event) => setLinhas((atual) => atual.map((item) => item.id === linha.id ? { ...item, quantidade: event.target.value } : item))} />
          {opcao && <span className="mt-1 block text-[10px] text-slate-500">Necessária pela OP: {opcao.quantidadePlanejada}</span>}
        </div>
        <button
          type="button"
          onClick={() => removerLinha(linha)}
          disabled={linhas.length === 1}
          className="rounded border border-slate-700 px-2 py-2 text-xs font-semibold text-slate-400 transition hover:border-rose-400/50 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={`Remover peça ${indice + 1}`}
        >
          Remover
        </button>
      </div>
    );
  }

  function validarEtapa(indice: number) {
    const painel = etapaRefs.current[indice];
    const invalido = painel?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(":invalid");
    if (!invalido) return true;
    invalido.reportValidity();
    invalido.focus();
    return false;
  }

  function avancarEtapa() {
    if (!validarEtapa(etapa)) return;
    setAviso("");
    setEtapa((atual) => Math.min(2, atual + 1));
  }

  function voltarEtapa() {
    setAviso("");
    setEtapa((atual) => Math.max(0, atual - 1));
  }

  return (
    <form ref={formRef} action={acao} noValidate className="space-y-5" onSubmit={(event) => {
      const invalido = event.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(":invalid");
      if (invalido) {
        event.preventDefault();
        setAviso("Confira os campos obrigatórios. Se o PDF identificou uma peça, ainda falta vincular a OP correta.");
        const painel = invalido.closest<HTMLElement>("[data-etapa]");
        const etapaComErro = Number(painel?.dataset.etapa);
        if (Number.isInteger(etapaComErro)) setEtapa(etapaComErro);
        window.setTimeout(() => { invalido.reportValidity(); invalido.focus(); }, 0);
      } else {
        setAviso("");
      }
    }}>
      <input type="hidden" name="setorId" value={setorId} />
      <input type="hidden" name="maquinaImportada" value={maquinaImportada} />

      <div className="grid gap-2 sm:grid-cols-3">
        {["Identificação", "Dados técnicos", "OPs e peças"].map((nome, indice) => (
          <button
            key={nome}
            type="button"
            onClick={() => { if (indice <= etapa || validarEtapa(etapa)) { setAviso(""); setEtapa(indice); } }}
            className={`rounded-lg border px-3 py-2 text-left transition ${etapa === indice ? "border-cyan-300 bg-cyan-400/15 text-cyan-100" : indice < etapa ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200" : "border-slate-700 bg-slate-950/20 text-slate-500 hover:border-slate-500"}`}
          >
            <span className="block font-mono text-[9px] font-bold uppercase tracking-wider">Etapa {indice + 1}</span>
            <span className="mt-1 block text-xs font-semibold">{nome}</span>
          </button>
        ))}
      </div>

      <div ref={(node) => { etapaRefs.current[0] = node; }} data-etapa="0" hidden={etapa !== 0} className="space-y-4">
        <ImportadorPdfLibellula onImportar={importarPdf} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Campo label="Código do nest" dica="Ex.: NEST3530" obrigatorio>
            <input name="codigo" required placeholder="NEST3530" className={inputClass} />
          </Campo>
          <Campo label="Setor de corte" obrigatorio>
            <select
              value={setorId}
              onChange={(event) => mudarSetor(Number(event.target.value))}
              className={inputClass}
            >
              {setores.map((setor) => <option key={setor.id} value={setor.id}>{setor.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Máquina">
            <select name="maquinaId" className={inputClass} value={maquinaId} onChange={(event) => setMaquinaId(event.target.value)}>
              <option value="">Usar máquina do PDF / selecione</option>
              {maquinasDoSetor.map((maquina) => (
                <option key={maquina.id} value={maquina.id}>{maquina.codigo} - {maquina.nome}</option>
              ))}
            </select>
            {!maquinaId && maquinaImportada && <span className="mt-1 block text-[11px] text-cyan-200">Será criada a máquina informada no PDF: {maquinaImportada}</span>}
          </Campo>
          <Campo label="Arquivo / referência">
            <input name="nomeArquivo" placeholder="NEST3530 - 6,35 - PLS 1" className={inputClass} />
          </Campo>
        </div>
      </div>

      <div ref={(node) => { etapaRefs.current[1] = node; }} data-etapa="1" hidden={etapa !== 1} className="space-y-4">
        <section className="rounded-lg border border-slate-700/80 bg-slate-950/30 p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-300">Dados técnicos</p>
          <p className="mt-1 text-xs text-slate-400">Se o PDF foi importado, confira os valores. O preenchimento manual é opcional, exceto a quantidade de chapas.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Campo label="Material"><input name="material" defaultValue="Aço" className={inputClass} /></Campo>
            <Campo label="Espessura (mm)"><input name="espessuraMm" type="number" min="0" step="any" placeholder="6,35" className={inputClass} /></Campo>
            <Campo label="Largura (mm)"><input name="larguraChapaMm" type="number" min="0" step="any" placeholder="1205" className={inputClass} /></Campo>
            <Campo label="Altura (mm)"><input name="alturaChapaMm" type="number" min="0" step="any" placeholder="2000" className={inputClass} /></Campo>
            <Campo label="Chapas"><input name="quantidadeChapas" type="number" min="1" step="1" defaultValue="1" required className={inputClass} /></Campo>
            <Campo label="Perfurações"><input name="numeroPiercings" type="number" min="0" step="1" placeholder="108" className={inputClass} /></Campo>
            <Campo label="Peso chapa (kg)"><input name="pesoChapaKg" type="number" min="0" step="any" className={inputClass} /></Campo>
            <Campo label="Peso peças (kg)"><input name="pesoPecasKg" type="number" min="0" step="any" className={inputClass} /></Campo>
            <Campo label="Sobra (kg)"><input name="pesoSobraKg" type="number" min="0" step="any" className={inputClass} /></Campo>
            <Campo label="Aproveitamento (%)"><input name="aproveitamentoPct" type="number" min="0" step="any" placeholder="79,21" className={inputClass} /></Campo>
            <Campo label="Corte (mm)"><input name="comprimentoCorteMm" type="number" min="0" step="any" className={inputClass} /></Campo>
            <Campo label="Movimento rápido (mm)"><input name="comprimentoRapidoMm" type="number" min="0" step="any" className={inputClass} /></Campo>
            <Campo label="Tempo corte (seg.)"><input name="tempoCorteSegundos" type="number" min="0" step="1" placeholder="1326" className={inputClass} /></Campo>
            <Campo label="Deslocamento (seg.)"><input name="tempoDeslocamentoSegundos" type="number" min="0" step="1" placeholder="275" className={inputClass} /></Campo>
          </div>
        </section>

        <Campo label="Observações da programação">
          <textarea name="observacao" rows={2} placeholder="Material, prioridade, observações do operador ou do programa." className={`${inputClass} resize-y`} />
        </Campo>
      </div>

      <div ref={(node) => { etapaRefs.current[2] = node; }} data-etapa="2" hidden={etapa !== 2} className="rounded-lg border border-slate-700/80 bg-slate-950/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-300">OPs e peças do Plasma</p>
            <p className="mt-1 text-xs text-slate-400">Escolha uma OP para abrir automaticamente todas as suas peças de Plasma. Você pode adicionar mais de uma OP na mesma chapa.</p>
          </div>
          <button
            type="button"
            onClick={adicionarLinhaManual}
            className="rounded border border-cyan-400/40 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/10"
          >
            + Vincular peça manualmente
          </button>
        </div>

        <div className="mt-3">
          <Campo label="Adicionar OP ao NEST">
            <select value={opSelecionadaId} onChange={(event) => { setOpSelecionadaId(event.target.value); if (event.target.value) adicionarOp(event.target.value); }} className={inputClass}>
              <option value="">Selecione uma OP aberta</option>
              {opsDoSetor.filter((op) => !opsSelecionadas.includes(op.id)).map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
            </select>
          </Campo>
        </div>

        <div className="mt-3 space-y-3">
          {opsSelecionadas.map((opId) => {
            const op = opPorId.get(opId);
            const linhasDaOp = linhas.filter((linha) => itemPorReferencia.get(linha.referencia)?.opId === opId);
            if (!op || !linhasDaOp.length) return null;
            return (
              <section key={opId} className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.03] p-2">
                <p className="mb-2 px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-200">{op.label}</p>
                <div className="space-y-2">{linhasDaOp.map((linha, indice) => renderLinha(linha, indice))}</div>
              </section>
            );
          })}

          {linhas.filter((linha) => !itemPorReferencia.has(linha.referencia)).map((linha, indice) => renderLinha(linha, indice))}
          {!linhas.length && <p className="rounded border border-amber-400/20 bg-amber-400/5 p-2 text-xs text-amber-200">Adicione uma OP ou vincule uma peça manualmente.</p>}
          {!opsDoSetor.length && <p className="rounded border border-amber-400/20 bg-amber-400/5 p-2 text-xs text-amber-200">Não há OPs abertas com peças de corte configuradas neste setor.</p>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        {etapa > 0 ? <button type="button" onClick={voltarEtapa} className="rounded border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100">← Voltar</button> : <span />}
        {etapa < 2 ? (
          <button type="button" onClick={avancarEtapa} className="rounded bg-cyan-400 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300">Próxima etapa →</button>
        ) : (
          <button type="submit" disabled={pendente} className="rounded bg-cyan-400 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60">
            {pendente ? "Registrando…" : "Registrar nest programado"}
          </button>
        )}
      </div>
      {(aviso || resultado) && <p role="status" className={`text-right text-xs ${resultado?.ok ? "text-emerald-200" : resultado && !resultado.ok ? "text-rose-200" : "text-amber-200"}`}>{resultado?.mensagem ?? aviso}</p>}
    </form>
  );
}

const inputClass = "w-full rounded border border-slate-700 bg-[#111925] px-2.5 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30";

function Campo({
  label,
  dica,
  obrigatorio = false,
  children,
}: {
  label: string;
  dica?: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}{obrigatorio ? " *" : ""}{dica ? <span className="ml-1 normal-case tracking-normal text-slate-600">{dica}</span> : null}
      </span>
      {children}
    </label>
  );
}

