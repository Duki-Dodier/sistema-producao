import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateSetorConfig } from "@/lib/actions/setores";
import {
  createFuncionario,
  toggleFuncionario,
  deleteFuncionario,
  updateFuncionarioAcesso,
} from "@/lib/actions/funcionarios";

const INPUT_CLS =
  "rounded border border-slate-700 bg-[#1A222C] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-[#3B82F6] focus:outline-none transition-colors";

export default async function ConfiguracoesPage() {
  const setores = await prisma.setor.findMany({
    orderBy: { ordemPadrao: "asc" },
    include: {
      funcionarios: { orderBy: { nome: "asc" } },
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
            Funcionários por setor · líderes · metas · dias trabalhados
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
          className="flex flex-wrap items-end gap-3 px-5 py-4"
        >
          <div className="flex flex-1 min-w-48 flex-col gap-1.5">
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
          <div className="flex w-52 flex-col gap-1.5">
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
            className="rounded bg-[#3B82F6] px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-500"
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
                <h2 className="text-sm font-semibold text-slate-100">
                  {setor.nome}
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {setor.funcionarios.filter((f) => f.ativo).length} ativo(s)
                </span>
              </div>

              {/* Config: meta, líder, dias úteis */}
              <form
                action={boundConfig}
                className="flex flex-wrap items-end gap-3 border-b border-white/5 bg-[#1E2733] px-5 py-3"
              >
                <div className="flex w-28 flex-col gap-1">
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
                <div className="flex flex-1 min-w-32 flex-col gap-1">
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
                <div className="flex w-28 flex-col gap-1">
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
                  return (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-2"
                    >
                      <span
                        className={`min-w-28 text-sm ${
                          f.ativo ? "text-slate-200" : "text-slate-500 line-through"
                        }`}
                      >
                        {f.nome}
                        {f.ativo && !f.pin && (
                          <span
                            className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400"
                            title="Sem PIN: aponta sem senha até você definir um"
                          >
                            sem PIN
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <form action={boundAcesso} className="flex items-center gap-2">
                          <select
                            key={`papel-${f.id}-${f.papel}`}
                            name="papel"
                            defaultValue={f.papel}
                            className="rounded border border-slate-700 bg-[#1A222C] px-2 py-1 text-[11px] text-slate-200 focus:border-[#3B82F6] focus:outline-none"
                            title="Papel: Líder autoriza ajustes do próprio setor; PCP autoriza qualquer setor"
                          >
                            <option value="OPERADOR">Operador</option>
                            <option value="LIDER">Líder</option>
                            <option value="PCP">PCP</option>
                          </select>
                          <input
                            key={`pin-${f.id}-${f.pin ?? ""}`}
                            name="pin"
                            defaultValue={f.pin ?? ""}
                            placeholder="PIN"
                            maxLength={4}
                            pattern="\d{4}"
                            className="w-16 rounded border border-slate-700 bg-[#1A222C] px-2 py-1 text-center font-mono text-[11px] tracking-[0.2em] text-slate-200 placeholder-slate-600 focus:border-[#3B82F6] focus:outline-none"
                            title="PIN de 4 dígitos (vazio = sem PIN)"
                          />
                          <button
                            type="submit"
                            className="rounded bg-[#3B82F6]/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-300 transition-colors hover:bg-[#3B82F6]/35"
                          >
                            Salvar
                          </button>
                        </form>
                        <form action={boundToggle}>
                          <button
                            type="submit"
                            className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                              f.ativo
                                ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                                : "bg-slate-700/40 text-slate-500 hover:bg-slate-700/60"
                            }`}
                            title={f.ativo ? "Clique p/ desativar" : "Clique p/ reativar"}
                          >
                            {f.ativo ? "Ativo" : "Inativo"}
                          </button>
                        </form>
                        <form action={boundDelete}>
                          <button
                            type="submit"
                            className="text-[10px] font-bold uppercase tracking-wider text-red-500 transition-colors hover:text-red-400"
                          >
                            Excluir
                          </button>
                        </form>
                      </div>
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
