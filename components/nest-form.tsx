"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { ImportadorPdfLibellula } from "@/components/importador-pdf-libellula";
import { criarNestCorte } from "@/lib/actions/nests";
import type { DadosImportadosLibellula } from "@/lib/libellula-pdf";

type Setor = { id: number; nome: string };
type Maquina = { id: number; codigo: string; nome: string; setorId: number };
type OpcaoItem = { referencia: string; setorId: number; descricao: string; codigoPeca: string };
type Linha = { id: number; referencia: string; quantidade: string; identificacaoPdf?: string };

export function NestForm({
  setores,
  maquinas,
  opcoesItem,
}: {
  setores: Setor[];
  maquinas: Maquina[];
  opcoesItem: OpcaoItem[];
}) {
  type Resultado = { ok: true; mensagem: string } | { ok: false; mensagem: string };
  const [setorId, setSetorId] = useState(setores[0]?.id ?? 0);
  const [maquinaId, setMaquinaId] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([{ id: 1, referencia: "", quantidade: "" }]);
  const [maquinaImportada, setMaquinaImportada] = useState("");
  const [aviso, setAviso] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [resultado, acao, pendente] = useActionState<Resultado | null, FormData>(async (_anterior, formData) => {
    try {
      await criarNestCorte(formData);
      return { ok: true, mensagem: "Nest registrado com sucesso. Ele já aparece na lista de rastreabilidade." };
    } catch (erro) {
      return { ok: false, mensagem: erro instanceof Error ? erro.message : "Não foi possível registrar o nest." };
    }
  }, null);
  const maquinasDoSetor = useMemo(() => maquinas.filter((maquina) => maquina.setorId === setorId), [maquinas, setorId]);
  const itensDoSetor = useMemo(() => opcoesItem.filter((item) => item.setorId === setorId), [opcoesItem, setorId]);

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
      setLinhas(dados.pecas.map((peca, indice) => {
        const candidatas = opcoesItem.filter((item) => item.setorId === setorImportado && normalizar(item.codigoPeca) === normalizar(peca.codigo));
        return {
          id: indice + 1,
          referencia: candidatas.length === 1 ? candidatas[0].referencia : "",
          quantidade: String(peca.quantidade),
          identificacaoPdf: `${peca.codigo}${peca.descricao ? ` - ${peca.descricao}` : ""}`,
        };
      }));
    }
  }

  return (
    <form ref={formRef} action={acao} className="space-y-5" onSubmit={(event) => {
      if (!event.currentTarget.checkValidity()) {
        event.preventDefault();
        setAviso("Confira os campos obrigatórios. Se o PDF identificou uma peça, ainda falta vincular a OP correta.");
        event.currentTarget.querySelector<HTMLElement>(":invalid")?.focus();
      } else {
        setAviso("");
      }
    }}>
      <input type="hidden" name="setorId" value={setorId} />
      <input type="hidden" name="maquinaImportada" value={maquinaImportada} />

      <ImportadorPdfLibellula onImportar={importarPdf} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Campo label="Código do nest" dica="Ex.: NEST3530" obrigatorio>
          <input name="codigo" required placeholder="NEST3530" className={inputClass} />
        </Campo>
        <Campo label="Setor de corte" obrigatorio>
          <select
            value={setorId}
            onChange={(event) => { setSetorId(Number(event.target.value)); setMaquinaId(""); }}
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

      <details className="rounded-lg border border-slate-700/80 bg-slate-950/30 p-3">
        <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-300">Dados técnicos - preenchimento manual somente se necessário</summary>
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
      </details>

      <div className="rounded-lg border border-slate-700/80 bg-slate-950/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-300">Peças programadas</p>
            <p className="mt-1 text-xs text-slate-400">Cada linha liga uma peça à sua OP. Você pode misturar OPs na mesma chapa.</p>
          </div>
          <button
            type="button"
            onClick={() => setLinhas((atual) => [...atual, { id: Math.max(...atual.map((linha) => linha.id), 0) + 1, referencia: "", quantidade: "" }])}
            className="rounded border border-cyan-400/40 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/10"
          >
            + Adicionar peça
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {linhas.map((linha, indice) => (
            <div key={linha.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
              {linha.identificacaoPdf && <p className="sm:col-span-3 -mb-1 text-[11px] text-cyan-200">Identificado no PDF: {linha.identificacaoPdf}</p>}
              <select name="itemRef" required className={inputClass} value={linha.referencia} onChange={(event) => setLinhas((atual) => atual.map((item) => item.id === linha.id ? { ...item, referencia: event.target.value } : item))}>
                <option value="">Selecione a peça da OP</option>
                {itensDoSetor.map((item) => <option key={item.referencia} value={item.referencia}>{item.descricao}</option>)}
              </select>
              <input name="itemQuantidade" type="number" min="1" step="1" required placeholder="Qtd." className={inputClass} value={linha.quantidade} onChange={(event) => setLinhas((atual) => atual.map((item) => item.id === linha.id ? { ...item, quantidade: event.target.value } : item))} />
              <button
                type="button"
                onClick={() => setLinhas((atual) => atual.length === 1 ? atual : atual.filter((item) => item.id !== linha.id))}
                disabled={linhas.length === 1}
                className="rounded border border-slate-700 px-2 text-xs font-semibold text-slate-400 transition hover:border-rose-400/50 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={`Remover peça ${indice + 1}`}
              >
                Remover
              </button>
            </div>
          ))}
          {!itensDoSetor.length && <p className="rounded border border-amber-400/20 bg-amber-400/5 p-2 text-xs text-amber-200">Não há peças de OPs abertas com corte configurado neste setor.</p>}
        </div>
      </div>

      <Campo label="Observações da programação">
        <textarea name="observacao" rows={2} placeholder="Material, prioridade, observações do operador ou do programa." className={`${inputClass} resize-y`} />
      </Campo>

      <div className="flex justify-end">
        <button type="submit" disabled={pendente} className="rounded bg-cyan-400 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60">
          {pendente ? "Registrando…" : "Registrar nest programado"}
        </button>
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
