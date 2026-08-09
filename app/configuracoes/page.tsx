import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateSetorConfig } from "@/lib/actions/setores";
import {
  createFuncionario,
  toggleFuncionario,
  deleteFuncionario,
  updateFuncionarioAcesso,
} from "@/lib/actions/funcionarios";
import { PROCESSOS, PROCESSO_LABEL } from "@/lib/processos";
import { definicaoSetor } from "@/lib/setores";

const INPUT_CLS =
  "rounded border border-slate-700 bg-[#1A222C] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-[#3B82F6] focus:outline-none transition-colors";

export default async function ConfiguracoesPage() {
  const setores = await prisma.setor.findMany({
    orderBy: { ordemPadrao: "asc" },
    include: {
      funcionarios: {
        orderBy: { nome: "asc" },
        include: { processosPermitidos: { orderBy: { processo: "asc" } } },
      },
    },
  });

  const totalFuncionarios = setores.reduce(
    (s, x) => s + x.funcionarios.filter((f) => f.ativo).length,
    0,
  );

  return (
    <div className="flex min-h-full w-full flex-col gap-6 bg-[#242D3C] p-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Configurações
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Funcionários por setor · processos permitidos · líderes · metas · dias trabalhados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded border border-slate-700 bg-[#1A222C] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {totalFuncionarios} funcionário(s) ativo(s)
          </span>
          <Link
            href="/setores"
            className="rounded border border-slate-600 bg-[#2C3645] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-200 transition-colors hover:bg-slate-700"
          >
            Estrutura de setores →
          </Link>
        </div>
      </div>

      {/* CADASTRO DE FUNCIONÁRIO */}
      <div className="rounded-lg border border-white/5 bg-[#202A36]">
        <div className="rounded-t-lg border-b border-white/5 bg-[#1A222C] px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Novo funcionário
          </h2>
        </div>
        <form
          action={createFuncionario}
          className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end"
        >
          <div className="flex min-w-0 flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Nome
            </label>
            <input
              name="nome"
              required
              placeholder="Ex.: Anderson"
              className={INPUT_CLS}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Setor
            </label>
            <select name="setorId" required defaultValue="" className={INPUT_CLS}>
              <option value="" disabled>
                Selecione...
              </option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full rounded bg-[#3B82F6] px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-500 md:w-auto"
          >
            Adicionar
          </button>
        </form>
      </div>

      {/* UM CARD POR SETOR: config + funcionários */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {setores.map((setor) => {
          const boundConfig = updateSetorConfig.bind(null, setor.id);
          return (
            <div
              key={setor.id}
              className="flex flex-col rounded-lg border border-white/5 bg-[#202A36]"
            >
              <div className="flex items-center justify-between rounded-t-lg border-b border-white/5 bg-[#1A222C] px-5 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-100">{setor.nome}</h2>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      definicaoSetor(setor.nome)?.grupo === "FLUXO_FINAL"
                        ? "bg-amber-400/10 text-amber-200"
                        : "bg-cyan-400/10 text-cyan-200"
                    }`}>
                      {definicaoSetor(setor.nome)?.grupo === "FLUXO_FINAL" ? "fluxo final" : "preparação"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">{definicaoSetor(setor.nome)?.descricao}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {setor.funcionarios.filter((f) => f.ativo).length} ativo(s)
                </span>
              </div>

              {/* Config: meta, líder, dias úteis */}
              <form
                action={boundConfig}
                className="grid grid-cols-1 gap-3 border-b border-white/5 bg-[#1E2733] px-5 py-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-end"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Meta do mês
                  </label>
                  <input
                    name="metaMensal"
                    type="number"
                    min={0}
                    defaultValue={setor.metaMensal ?? ""}
                    placeholder="—"
                    className={`text-center ${INPUT_CLS}`}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Media/dia
                  </label>
                  <input
                    name="mediaDiariaMeta"
                    type="number"
                    min={0}
                    step="0.1"
                    defaultValue={setor.mediaDiariaMeta ?? ""}
                    placeholder="auto"
                    className={`text-center ${INPUT_CLS}`}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Líder
                  </label>
                  <input
                    name="lider"
                    defaultValue={setor.lider ?? ""}
                    placeholder="—"
                    className={INPUT_CLS}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Dias úteis/mês
                  </label>
                  <input
                    name="diasUteisMes"
                    type="number"
                    min={0}
                    max={31}
                    defaultValue={setor.diasUteisMes ?? ""}
                    placeholder="auto"
                    className={`text-center ${INPUT_CLS}`}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded bg-emerald-600 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-emerald-500"
                >
                  Salvar
                </button>
              </form>

              {/* Funcionários */}
              <ul className="flex-1 divide-y divide-white/5">
                {setor.funcionarios.map((f) => {
                  const boundToggle = toggleFuncionario.bind(null, f.id);
                  const boundDelete = deleteFuncionario.bind(null, f.id);
                  const boundAcesso = updateFuncionarioAcesso.bind(null, f.id);
                  const ehSetorSolda = setor.nome.trim().toLocaleUpperCase("pt-BR") === "SOLDA";
                  const processosAtuais = new Set(f.processosPermitidos.map((item) => item.processo));
                  return (
                    <li key={f.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-sm font-semibold ${f.ativo ? "text-slate-100" : "text-slate-500 line-through"}`}>
                              {f.nome}
                            </span>
                            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
                              @{f.usuario ?? "sem-usuario"}
                            </span>
                            {f.administrador && (
                              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                                administrador
                              </span>
                            )}
                            {f.ativo && !f.pin && (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400" title="Sem PIN: aponta sem senha até você definir um">
                                sem PIN
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                            Defina o acesso, a função e os processos que este funcionário pode apontar.
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <form action={boundToggle}>
                            <button
                              type="submit"
                              className={`rounded px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                                f.ativo
                                  ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                                  : "bg-slate-700/40 text-slate-500 hover:bg-slate-700/60"
                              }`}
                              title={f.ativo ? "Clique para desativar" : "Clique para reativar"}
                            >
                              {f.ativo ? "Ativo" : "Inativo"}
                            </button>
                          </form>
                          <form action={boundDelete}>
                            <button
                              type="submit"
                              className="rounded border border-red-500/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-red-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10"
                            >
                              Excluir
                            </button>
                          </form>
                        </div>
                      </div>

                      <form action={boundAcesso} className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <label className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Setor atual</span>
                            <select name="setorId" defaultValue={f.setorId} className={INPUT_CLS} title="Setor atual do funcionário">
                              {setores.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.nome}</option>)}
                            </select>
                          </label>
                          <label className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Função</span>
                            <select key={`papel-${f.id}-${f.papel}`} name="papel" defaultValue={f.papel} className={INPUT_CLS} title="Líder autoriza ajustes do próprio setor; PCP autoriza qualquer setor">
                              <option value="OPERADOR">Operador</option>
                              <option value="LIDER">Líder</option>
                              <option value="PCP">PCP</option>
                            </select>
                          </label>
                          <label className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">PIN de acesso</span>
                            <input key={`pin-${f.id}-${f.pin ?? ""}`} name="pin" defaultValue={f.pin ?? ""} placeholder="4 dígitos" maxLength={4} pattern="\d{4}" className={INPUT_CLS} title="PIN de 4 dígitos (vazio = sem PIN)" />
                          </label>
                          {ehSetorSolda ? (
                            <label className="flex min-w-0 flex-col gap-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bancada / box</span>
                              <input key={`bancada-${f.id}-${f.bancada ?? ""}`} name="bancada" defaultValue={f.bancada ?? ""} placeholder="BOX 01" className={INPUT_CLS} title="Bancada/box fixa do soldador" />
                            </label>
                          ) : <div className="hidden xl:block" aria-hidden="true" />}
                        </div>

                        <fieldset className="rounded-lg border border-slate-700/70 bg-[#151C26] p-3">
                          <legend className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Processos permitidos</legend>
                          <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
                            Marque somente as operações que este funcionário poderá apontar no celular ou no computador.
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {PROCESSOS.map((processo) => (
                              <label key={processo} className="flex min-h-9 items-center gap-2 rounded border border-white/5 bg-[#1A222C] px-2.5 py-2 text-[10px] font-medium text-slate-300 transition-colors hover:border-blue-400/40 hover:bg-blue-500/10">
                                <input type="checkbox" name="processos" value={processo} defaultChecked={processosAtuais.has(processo)} className="h-3.5 w-3.5 shrink-0 accent-blue-500" />
                                <span className="leading-tight">{PROCESSO_LABEL[processo]}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <div className="flex justify-end border-t border-white/5 pt-3">
                          <button type="submit" className="rounded bg-[#3B82F6] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/15 transition-colors hover:bg-blue-500">
                            Salvar acesso e processos
                          </button>
                        </div>
                      </form>
                    </li>
                  );
                })}
                {setor.funcionarios.length === 0 && (
                  <li className="px-5 py-4 text-center text-[11px] uppercase tracking-wider text-slate-600">
                    Nenhum funcionário neste setor
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
