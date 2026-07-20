import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TIPO_LABEL } from "@/lib/labels";
import { ehSetor } from "@/lib/setores";

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const INPUT_CLS =
  "rounded border border-slate-700 bg-[#1A222C] px-2 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 focus:border-[#3B82F6] focus:outline-none transition-colors";

export default async function SoldaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim().toLowerCase();
  const soldadorFiltro = (sp.soldador ?? "").trim();
  const dataInicio = sp.inicio ? new Date(`${sp.inicio}T00:00:00`) : null;
  const dataFim = sp.fim ? new Date(`${sp.fim}T23:59:59`) : null;
  const setorSolda = (await prisma.setor.findMany({ select: { id: true, nome: true } }))
    .find((setor) => ehSetor(setor.nome, "Solda"));
  const setorSoldaId = setorSolda?.id ?? -1;

  const envios = await prisma.apontamento.findMany({
    where: {
      setorId: setorSoldaId,
      // Abastecimentos têm soldador preenchido. Registros com soldador nulo
      // são produção e aparecem somente na coluna de quantidade soldada.
      soldador: soldadorFiltro ? soldadorFiltro : { not: null },
      ...(dataInicio || dataFim
        ? {
            dataHora: {
              ...(dataInicio ? { gte: dataInicio } : {}),
              ...(dataFim ? { lte: dataFim } : {}),
            },
          }
        : {}),
    },
    orderBy: { dataHora: "asc" },
    include: { op: { include: { modelo: true } } },
  });

  const apontamentosDeSolda = await prisma.apontamento.findMany({
    where: {
      setorId: setorSoldaId,
      soldador: null,
      ...(soldadorFiltro ? { usuario: soldadorFiltro } : {}),
      ...(dataInicio || dataFim
        ? {
            dataHora: {
              ...(dataInicio ? { gte: dataInicio } : {}),
              ...(dataFim ? { lte: dataFim } : {}),
            },
          }
        : {}),
    },
    select: { opId: true, usuario: true, quantidadeBoa: true, dataHora: true },
  });

  const producaoPorOpESoldador = new Map<string, number>();
  for (const apontamento of apontamentosDeSolda) {
    const chave = `${apontamento.opId}|${apontamento.usuario}`;
    producaoPorOpESoldador.set(chave, (producaoPorOpESoldador.get(chave) ?? 0) + apontamento.quantidadeBoa);
  }
  const quantidadeSoldadaPorEnvio = new Map<number, number>();
  for (const envio of envios) {
    const chave = `${envio.opId}|${envio.soldador ?? ""}`;
    const restante = producaoPorOpESoldador.get(chave) ?? 0;
    const soldada = Math.min(restante, envio.quantidadeBoa);
    quantidadeSoldadaPorEnvio.set(envio.id, soldada);
    producaoPorOpESoldador.set(chave, restante - soldada);
  }

  const enviosFiltrados = busca
    ? envios.filter((e) => {
        const alvo =
          `${e.op.numeroSequencia} ${e.op.lote ?? ""} ${e.op.modelo.codigo} ${e.op.modelo.nome ?? ""} ${e.soldador ?? ""} ${e.bancada ?? ""} ${e.abastecedor ?? ""}`.toLowerCase();
        return alvo.includes(busca);
      })
    : envios;

  // Opções do filtro de soldador (todos os que já receberam envio).
  const soldadoresTodos = await prisma.apontamento.findMany({
    where: { setorId: setorSoldaId, soldador: { not: null } },
    select: { soldador: true },
    distinct: ["soldador"],
  });
  const opcoesSoldador = soldadoresTodos
    .map((s) => s.soldador!)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  // Métricas do topo.
  const hoje = new Date().toDateString();
  const abastecidasHoje = envios
    .filter((e) => e.dataHora.toDateString() === hoje)
    .reduce((s, e) => s + e.quantidadeBoa, 0);
  const soldadasHoje = apontamentosDeSolda
    .filter((e) => e.dataHora.toDateString() === hoje)
    .reduce((s, e) => s + e.quantidadeBoa, 0);
  const pendenteSolda = envios.reduce(
    (s, e) => s + (e.quantidadeBoa - (quantidadeSoldadaPorEnvio.get(e.id) ?? 0)),
    0,
  );

  return (
    <div className="flex min-h-full w-full flex-col gap-6 bg-[#242D3C] p-6 font-sans">
      {/* 1. MÉTRICAS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-lg border border-white/5 bg-[#2C3645] p-4 shadow-lg">
          <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Peças abastecidas hoje
          </span>
          <span className="text-3xl font-light text-white">
            {abastecidasHoje.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-white/5 bg-[#2C3645] p-4 shadow-lg">
          <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Peças soldadas hoje
          </span>
          <span className="text-3xl font-light text-emerald-400">
            {soldadasHoje.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-white/5 bg-[#2C3645] p-4 shadow-lg">
          <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Aguardando solda (abastecido − soldado)
          </span>
          <span className="text-3xl font-light text-amber-400">
            {pendenteSolda.toLocaleString("pt-BR")}
          </span>
        </div>
      </div>

      {/* 2. LISTA DE ABASTECIMENTOS */}
      <div className="rounded-lg border border-white/5 bg-[#202A36]">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-white/5 bg-[#1A222C] px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Abastecimentos da Solda ({enviosFiltrados.length})
            </h2>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
              Quantidade soldada vinda do Monitoramento, por OP e soldador.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          <Link
            href="/solda/relatorio-geral"
            className="flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 transition-colors hover:bg-emerald-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5" strokeWidth={2}>
              <path d="M4 19V9M10 19V5M16 19v-8M22 19V3" />
            </svg>
            Relatório geral
          </Link>
          <Link
            href="/solda/relatorio"
            className="flex items-center gap-2 rounded bg-[#3B82F6] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5" strokeWidth={2}>
              <path d="M12 20v-6M6 20V10M18 20V4" />
            </svg>
            Relatório por Soldador
          </Link>
          </div>
        </div>

        {/* FILTROS */}
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 border-b border-white/5 bg-[#1E2733] px-5 py-3"
        >
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Buscar
            </label>
            <input
              name="busca"
              defaultValue={sp.busca ?? ""}
              placeholder="OP, modelo, bancada..."
              className={`w-48 ${INPUT_CLS}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Soldador
            </label>
            <select
              name="soldador"
              defaultValue={sp.soldador ?? ""}
              className={`w-40 ${INPUT_CLS}`}
            >
              <option value="">Todos</option>
              {opcoesSoldador.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              De
            </label>
            <input
              type="date"
              name="inicio"
              defaultValue={sp.inicio ?? ""}
              className={INPUT_CLS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Até
            </label>
            <input
              type="date"
              name="fim"
              defaultValue={sp.fim ?? ""}
              className={INPUT_CLS}
            />
          </div>
          <button
            type="submit"
            className="rounded bg-[#2C3645] border border-slate-600 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-200 transition-colors hover:bg-slate-700"
          >
            Filtrar
          </button>
          <Link
            href="/solda"
            className="pb-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-300"
          >
            Limpar
          </Link>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[11px] text-slate-300">
            <thead>
              <tr className="border-b border-white/5 bg-[#1A222C] text-slate-400">
                <th className="whitespace-nowrap border-r border-white/5 px-3 py-3 font-semibold">Data</th>
                <th className="whitespace-nowrap border-r border-white/5 px-3 py-3 font-semibold">Nº OP</th>
                <th className="whitespace-nowrap border-r border-white/5 px-3 py-3 font-semibold">Lote</th>
                <th className="whitespace-nowrap border-r border-white/5 px-3 py-3 font-semibold">Código SKU</th>
                <th className="whitespace-nowrap border-r border-white/5 px-3 py-3 font-semibold text-right">Qtde Abastecida</th>
                <th className="whitespace-nowrap border-r border-white/5 px-3 py-3 font-semibold text-center bg-emerald-900/20">Qtde Soldada</th>
                <th className="whitespace-nowrap border-r border-white/5 px-3 py-3 font-semibold">Soldador</th>
                <th className="whitespace-nowrap border-r border-white/5 px-3 py-3 font-semibold">Quem Abastece</th>
                <th className="whitespace-nowrap border-r border-white/5 px-3 py-3 font-semibold">Bancada</th>
                <th className="whitespace-nowrap border-r border-white/5 px-3 py-3 font-semibold text-center">Curva</th>
                <th className="whitespace-nowrap px-3 py-3 font-semibold">Fixo/Rem.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[...enviosFiltrados].reverse().map((e, i) => {
                const quantidadeSoldada = quantidadeSoldadaPorEnvio.get(e.id) ?? 0;
                const completo = quantidadeSoldada >= e.quantidadeBoa;
                return (
                  <tr
                    key={e.id}
                    className={`transition-colors hover:bg-[#2C3645] ${i % 2 === 0 ? "bg-[#202A36]" : "bg-[#242D3C]"}`}
                  >
                    <td className="whitespace-nowrap border-r border-white/5 px-3 py-2 text-slate-400">
                      {formatDate(e.dataHora)}
                    </td>
                    <td className="whitespace-nowrap border-r border-white/5 px-3 py-2 font-mono font-semibold text-slate-100">
                      {e.op.numeroSequencia}
                    </td>
                    <td className="whitespace-nowrap border-r border-white/5 px-3 py-2 font-mono text-slate-300">
                      {e.op.lote || <span className="text-slate-500">S/L</span>}
                    </td>
                    <td className="whitespace-nowrap border-r border-white/5 px-3 py-2 font-mono text-slate-200">
                      {e.op.modelo.codigo}
                      {e.op.modelo.nome && (
                        <span className="ml-2 text-[10px] text-slate-500">
                          {e.op.modelo.nome}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-r border-white/5 px-3 py-2 text-right font-mono font-bold text-slate-200">
                      {e.quantidadeBoa}
                    </td>
                    <td className="whitespace-nowrap border-r border-white/5 bg-emerald-900/10 px-2 py-1.5 text-center">
                      <span
                        title="Quantidade apontada no Monitoramento para esta OP e soldador"
                        className={`font-mono font-bold ${completo ? "text-emerald-400" : "text-amber-300"}`}
                      >
                        {quantidadeSoldada}/{e.quantidadeBoa}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-r border-white/5 px-3 py-2 font-medium text-emerald-200">
                      {e.soldador ?? "—"}
                    </td>
                    <td className="whitespace-nowrap border-r border-white/5 px-3 py-2 text-slate-300">
                      {e.abastecedor ?? "—"}
                    </td>
                    <td className="whitespace-nowrap border-r border-white/5 px-3 py-2 font-mono text-slate-200">
                      {e.bancada ?? "—"}
                    </td>
                    <td className="whitespace-nowrap border-r border-white/5 px-3 py-2 text-center">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-600 bg-[#374151] text-[10px] font-bold text-slate-300">
                        {e.op.modelo.curva}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {TIPO_LABEL[e.op.modelo.tipo] ?? e.op.modelo.tipo}
                    </td>
                  </tr>
                );
              })}
              {enviosFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-16 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-500"
                  >
                    Nenhum envio encontrado — ajuste os filtros ou envie uma OP
                    pelo Agrupamento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
