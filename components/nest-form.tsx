"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImportadorPdfLibellula } from "@/components/importador-pdf-libellula";
import { criarNestCorte } from "@/lib/actions/nests";
import type { DadosImportadosLibellula } from "@/lib/libellula-pdf";
import { rotuloMaquina } from "@/lib/maquinas";

type Setor = { id: number; nome: string };
type Maquina = { id: number; codigo: string; nome: string; setorId: number };
type OpcaoItem = { referencia: string; setorId: number; opId: number; descricao: string; codigoPeca: string; imagemUrl: string | null; quantidadePlanejada: number; quantidadeNecessaria: number; perdas: number; reposicao: boolean };
type OpcaoOP = { id: number; label: string; itens: OpcaoItem[] };
type Linha = { id: number; referencia: string; quantidade: string; identificacaoPdf?: string };

export function NestForm({
  setores,
  maquinas,
  opcoesOP,
  modoReposicao = false,
}: {
  setores: Setor[];
  maquinas: Maquina[];
  opcoesOP: OpcaoOP[];
  modoReposicao?: boolean;
}) {
  type Resultado = { ok: true; mensagem: string } | { ok: false; mensagem: string };
  const [setorId, setSetorId] = useState(setores[0]?.id ?? 0);
  const [maquinaId, setMaquinaId] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([{ id: 1, referencia: "", quantidade: "" }]);
  const [buscaOp, setBuscaOp] = useState("");
  const [opsSelecionadas, setOpsSelecionadas] = useState<number[]>([]);
  const [maquinaImportada, setMaquinaImportada] = useState("");
  const [aviso, setAviso] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [resultado, acao, pendente] = useActionState<Resultado | null, FormData>(async (_anterior, formData) => {
    try {
      await criarNestCorte(formData);
      return { ok: true, mensagem: "Nest registrado com sucesso. Ele já aparece na lista de rastreabilidade." };
    } catch (erro) {
      return { ok: false, mensagem: erro instanceof Error ? erro.message : "Não foi possível registrar o nest." };
    }
  }, null);
  useEffect(() => {
    if (resultado?.ok) router.push("/plasma?cadastrado=1");
  }, [resultado, router]);
  const maquinasDoSetor = useMemo(() => maquinas.filter((maquina) => maquina.setorId === setorId), [maquinas, setorId]);
  const todasOpcoes = useMemo(() => opcoesOP.flatMap((op) => op.itens), [opcoesOP]);
  const opPorId = useMemo(() => new Map(opcoesOP.map((op) => [op.id, op])), [opcoesOP]);
  const itemPorReferencia = useMemo(() => new Map(todasOpcoes.map((item) => [item.referencia, item])), [todasOpcoes]);
  const opsDoSetor = useMemo(() => opcoesOP.filter((op) => op.itens.some((item) => item.setorId === setorId)), [opcoesOP, setorId]);

  function normalizar(valor: string) {
    return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  }

  const opsDisponiveis = useMemo(() => opsDoSetor.filter((op) => !opsSelecionadas.includes(op.id)), [opsDoSetor, opsSelecionadas]);
  const opsFiltradas = useMemo(() => {
    const termo = normalizar(buscaOp);
    if (!termo) return [];
    return opsDisponiveis.filter((op) => normalizar([op.label, ...op.itens.flatMap((item) => [item.codigoPeca, item.descricao])].join(" ")).includes(termo)).slice(0, 8);
  }, [buscaOp, opsDisponiveis]);

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
    setSetorId(setorImportado);
    setMaquinaId(maquina ? String(maquina.id) : "");
    setMaquinaImportada(dados.maquina ?? "");
    setAviso(!maquina && dados.maquina ? `A máquina "${dados.maquina}" do PDF não corresponde às máquinas cadastradas. Selecione a correta.` : "");

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
    setBuscaOp("");
    setOpsSelecionadas([]);
    setLinhas([{ id: 1, referencia: "", quantidade: "" }]);
    if (haviaPecas) setAviso("As peças escolhidas foram limpas porque o setor foi alterado.");
  }

  function adicionarOp(opIdTexto: string) {
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
    setBuscaOp("");
    setAviso("");
  }

  function adicionarLinhaManual() {
    setLinhas((atual) => [...atual, { id: Math.max(0, ...atual.map((linha) => linha.id)) + 1, referencia: "", quantidade: "" }]);
  }

  function vincularLinhaManual(linhaId: number, referencia: string) {
    setLinhas((atual) => atual.map((item) => item.id === linhaId ? { ...item, referencia } : item));
    const opId = itemPorReferencia.get(referencia)?.opId;
    if (opId) setOpsSelecionadas((atual) => atual.includes(opId) ? atual : [...atual, opId]);
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
            <div className="flex min-w-0 items-center gap-3">
              <div className="group/peca-preview relative h-16 w-20 shrink-0 transition-[width,height] duration-200 hover:h-32 hover:w-40 focus-within:h-32 focus-within:w-40" title={opcao.imagemUrl ? `Imagem da peça ${opcao.codigoPeca}` : "Sem imagem cadastrada para esta peça"}>
                <a href={opcao.imagemUrl ?? undefined} target={opcao.imagemUrl ? "_blank" : undefined} tabIndex={opcao.imagemUrl ? 0 : -1} className="relative block h-full w-full overflow-hidden rounded border border-slate-700 bg-white transition group-hover/peca-preview:border-cyan-300 group-focus-within/peca-preview:border-cyan-300">
                  {opcao.imagemUrl ? (
                    <Image src={opcao.imagemUrl} alt={`Desenho da peça ${opcao.codigoPeca}`} fill sizes="160px" className="object-contain p-1" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center px-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-600">Sem imagem</div>
                  )}
                </a>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{op?.label ?? "OP selecionada"}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{opcao.descricao}</p>
              </div>
            </div>
          </>
        ) : (
          <select
            name="itemRef"
            required
            className={inputClass}
            value={linha.referencia}
            onChange={(event) => vincularLinhaManual(linha.id, event.target.value)}
          >
            <option value="">Vincular esta peça a uma OP</option>
            {todasOpcoes.filter((item) => item.setorId === setorId).map((item) => (
              <option key={item.referencia} value={item.referencia}>{opPorId.get(item.opId)?.label} · {item.descricao}</option>
            ))}
          </select>
        )}
        <div>
          <input name="itemQuantidade" type="number" min="1" step="1" required placeholder="Qtd." aria-label={`Quantidade a programar da peça ${indice + 1}`} className={inputClass} value={linha.quantidade} onChange={(event) => setLinhas((atual) => atual.map((item) => item.id === linha.id ? { ...item, quantidade: event.target.value } : item))} />
          {opcao && <span className="mt-1 block text-xs text-slate-500">Saldo: {opcao.quantidadePlanejada} de {opcao.quantidadeNecessaria}{opcao.reposicao ? ` · ${opcao.perdas} perdida(s)` : ""}</span>}
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

  return (
    <form ref={formRef} action={acao} noValidate className="space-y-5" onSubmit={(event) => {
      const invalido = event.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(":invalid");
      if (invalido) {
        event.preventDefault();
        setAviso("Confira os campos obrigatórios. Se o PDF identificou uma peça, ainda falta vincular a OP correta.");
        window.setTimeout(() => { invalido.reportValidity(); invalido.focus(); }, 0);
      } else {
        setAviso("");
      }
    }}>
      <input type="hidden" name="setorId" value={setorId} />
      <input type="hidden" name="maquinaImportada" value={maquinaImportada} />

      <section className="space-y-4 rounded-lg border border-cyan-400/25 bg-slate-950/20 p-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-300">Etapa 1 · Identificação</p>
          <p className="mt-1 text-xs text-slate-400">Informe os dados básicos do nest ou importe o relatório do Libellula.</p>
        </div>
        <ImportadorPdfLibellula onImportar={importarPdf} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          <Campo label="Arquivo / referência">
            <input name="nomeArquivo" placeholder="NEST3530 - 6,35 - PLS 1" className={inputClass} />
          </Campo>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Máquina de corte *</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {maquinasDoSetor.map((maquina) => (
              <label key={maquina.id} className={`cursor-pointer rounded-lg border p-3 transition ${maquinaId === String(maquina.id) ? "border-cyan-300 bg-cyan-400/10 text-white" : "border-slate-700 bg-[#111925] text-slate-300 hover:border-slate-500"}`}>
                <input type="radio" name="maquinaId" value={maquina.id} required checked={maquinaId === String(maquina.id)} onChange={(event) => setMaquinaId(event.target.value)} className="sr-only" />
                <span className="block text-sm font-bold">{rotuloMaquina(maquina.codigo, maquina.nome)}</span>
                <span className="mt-1 block text-xs text-slate-500">Selecionar para esta programação</span>
              </label>
            ))}
          </div>
          {!maquinaId && maquinaImportada && <span className="mt-2 block text-xs text-amber-200">Máquina lida no PDF: {maquinaImportada}. Confirme uma opção acima.</span>}
        </fieldset>
      </section>

      <section className="space-y-4 rounded-lg border border-cyan-400/25 bg-slate-950/20 p-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-300">Etapa 2 · Dados principais</p>
          <p className="mt-1 text-xs text-slate-400">Confira somente as informações essenciais. Os demais dados do PDF são mantidos automaticamente.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Campo label="Material"><input name="material" defaultValue="Aço" className={inputClass} /></Campo>
          <Campo label="Espessura (mm)"><input name="espessuraMm" type="number" min="0" step="any" placeholder="6,35" className={inputClass} /></Campo>
          <Campo label="Chapas"><input name="quantidadeChapas" type="number" min="1" step="1" defaultValue="1" required className={inputClass} /></Campo>
          <Campo label="Largura (mm)"><input name="larguraChapaMm" type="number" min="0" step="any" placeholder="1205" className={inputClass} /></Campo>
          <Campo label="Altura (mm)"><input name="alturaChapaMm" type="number" min="0" step="any" placeholder="2000" className={inputClass} /></Campo>
          <Campo label="Aproveitamento (%)"><input name="aproveitamentoPct" type="number" min="0" step="any" placeholder="79,21" className={inputClass} /></Campo>
        </div>

        <div className="hidden" aria-hidden="true">
          <input type="hidden" name="numeroPiercings" />
          <input type="hidden" name="pesoChapaKg" />
          <input type="hidden" name="pesoPecasKg" />
          <input type="hidden" name="pesoSobraKg" />
          <input type="hidden" name="comprimentoCorteMm" />
          <input type="hidden" name="comprimentoRapidoMm" />
          <input type="hidden" name="tempoCorteSegundos" />
          <input type="hidden" name="tempoDeslocamentoSegundos" />
        </div>

        <Campo label="Observações da programação">
          <textarea name="observacao" rows={2} placeholder="Material, prioridade, observações do operador ou do programa." className={`${inputClass} resize-y`} />
        </Campo>
      </section>

      <section className="space-y-4 rounded-lg border border-cyan-400/25 bg-slate-950/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-300">Etapa 3 · OPs e peças</p>
            <p className="mt-1 text-sm text-slate-400">{modoReposicao ? "Adicione OPs com perdas e monte uma programação única de reposição." : "Escolha uma OP para abrir as peças que ainda possuem saldo de programação."}</p>
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
            <div className="relative">
              <input
                value={buscaOp}
                onChange={(event) => setBuscaOp(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && opsFiltradas[0]) {
                    event.preventDefault();
                    adicionarOp(String(opsFiltradas[0].id));
                  }
                }}
                placeholder="Digite o código, lote ou modelo da OP..."
                autoComplete="off"
                role="combobox"
                aria-expanded={Boolean(buscaOp && opsFiltradas.length)}
                aria-controls="op-sugestoes"
                className={inputClass}
              />
              {buscaOp && opsFiltradas.length > 0 && (
                <div id="op-sugestoes" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-cyan-400/30 bg-[#111925] shadow-xl shadow-black/30" role="listbox">
                  {opsFiltradas.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => adicionarOp(String(op.id))}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-700/60 px-3 py-2 text-left last:border-b-0 hover:bg-cyan-400/10"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-slate-100">{op.label}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">{op.itens.length} peça(s)</span>
                    </button>
                  ))}
                </div>
              )}
              {buscaOp && !opsFiltradas.length && opsDisponiveis.length > 0 && (
                <p className="mt-1 text-[11px] text-amber-200">Nenhuma OP encontrada para esta busca.</p>
              )}
            </div>
            <span className="mt-1 block text-[11px] text-slate-500">
              Digite para filtrar as OPs abertas; pressione Enter para adicionar o primeiro resultado.
            </span>
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

          {linhas.filter((linha) => {
            const opId = itemPorReferencia.get(linha.referencia)?.opId;
            return !opId || !opsSelecionadas.includes(opId);
          }).map((linha, indice) => renderLinha(linha, indice))}
          {!linhas.length && <p className="rounded border border-amber-400/20 bg-amber-400/5 p-2 text-xs text-amber-200">Adicione uma OP ou vincule uma peça manualmente.</p>}
          {!opsDoSetor.length && <p className="rounded border border-amber-400/20 bg-amber-400/5 p-2 text-xs text-amber-200">Não há OPs abertas com peças de corte configuradas neste setor.</p>}
        </div>
      </section>

      <div className="flex justify-end gap-3">
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
