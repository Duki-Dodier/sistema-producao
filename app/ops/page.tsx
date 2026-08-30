import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createOP } from "@/lib/actions/ops";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/badge";
import { StatusSelect } from "@/components/status-select";
import { CURVA_VARIANT } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim();
  const status = ["ABERTA", "CONCLUIDA", "CANCELADA"].includes(sp.status ?? "") ? sp.status : "";
  const ordenar = ["sequencia", "liberacao", "status"].includes(sp.ordenar ?? "") ? sp.ordenar : "sequencia";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const porPagina = 25;
  const where = {
    ...(status ? { status } : {}),
    ...(busca ? { OR: [{ lote: { contains: busca } }, { modelo: { OR: [{ codigo: { contains: busca } }, { nome: { contains: busca } }] } }] } : {}),
  };
  const orderBy = ordenar === "liberacao"
    ? { dataLiberacao: "desc" as const }
    : ordenar === "status"
      ? { status: "asc" as const }
      : { numeroSequencia: "asc" as const };
  const [totalOps, ops, modelos] = await Promise.all([
    prisma.oP.count({ where }),
    prisma.oP.findMany({
      where,
      orderBy,
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        numeroSequencia: true,
        lote: true,
        quantidade: true,
        dataLiberacao: true,
        dataFinalizacao: true,
        status: true,
        modelo: {
          select: {
            codigo: true,
            tipo: true,
            tamanhoPonteira: true,
            curva: true,
            linhaProduto: true,
            estoqueMinimo: true,
          },
        },
      },
    }),
    prisma.modelo.findMany({
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, curva: true, linhaProduto: true, estoqueMinimo: true, tipo: true, tamanhoPonteira: true },
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(totalOps / porPagina));
  const query = (nextPagina: number) => {
    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);
    if (status) params.set("status", status);
    if (ordenar !== "sequencia") params.set("ordenar", ordenar);
    params.set("pagina", String(nextPagina));
    return `/ops?${params.toString()}`;
  };

  return (
    <div className="flex w-full flex-col gap-6 p-3 sm:p-6">
      <PageHeader
        title="Ordens de Produção"
        subtitle="A OP segue o roteiro do modelo. Engates e ponteiras macho podem ser liberados com fluxos próprios."
      />

      <Card>
        <CardHeader title="Liberar nova OP" />
        <form
          action={createOP}
          className="flex flex-wrap items-end gap-3 px-5 py-4"
        >
          <div className="flex w-32 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Nº sequência
            </label>
            <input
              name="numeroSequencia"
              type="number"
              min={0}
              max={1000}
              placeholder="auto"
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex w-32 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Lote
            </label>
            <input
              name="lote"
              type="text"
              required
              placeholder="LT-0001"
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-1 min-w-48 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Modelo
            </label>
            <select
              name="modeloId"
              required
              defaultValue=""
              className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>
                Selecione um modelo...
              </option>
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.tipo === "PONTEIRA_MACHO" ? `${m.codigo} · Ponteira macho ${m.tamanhoPonteira ?? ""}` : `${m.codigo} · Estoque regulador ${m.estoqueMinimo ?? "—"} · ${m.linhaProduto} · Curva ${m.curva}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-32 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Quantidade
            </label>
            <input
              name="quantidade"
              type="number"
              min={1}
              required
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex w-40 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Data (opcional)
            </label>
            <input
              name="dataLiberacao"
              type="date"
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex w-40 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Previsão entrega
            </label>
            <input
              name="previsaoEntrega"
              type="date"
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <SubmitButton>Liberar OP</SubmitButton>
        </form>
        <p className="px-5 pb-4 text-xs text-slate-400">
          Deixe a sequência em branco para usar automaticamente a próxima
          (última + 1). Deixe a data em branco para usar hoje.
        </p>
        <p className="border-t border-white/5 px-5 py-3 text-xs text-cyan-200/80">
          O roteiro exibido na tabela vem da ficha técnica do modelo. Para alterar os setores desta OP, ajuste o roteiro do modelo antes de liberar uma nova ordem.
        </p>
        {modelos.length === 0 && (
          <p className="px-5 pb-4 text-xs text-amber-700">
            Cadastre ao menos um modelo antes de liberar uma OP.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title={`OPs (${totalOps})`} subtitle="Altere o status conforme a situação real da ordem." />
        <form method="get" className="grid gap-3 border-b border-white/5 bg-[#1a222c] p-4 md:grid-cols-4">
          <input name="busca" defaultValue={busca} placeholder="Buscar lote, código ou descrição" className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200 placeholder-slate-500 md:col-span-2" />
          <select name="status" defaultValue={status} className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200"><option value="">Todos os status</option><option value="ABERTA">Abertas</option><option value="CONCLUIDA">Concluídas</option><option value="CANCELADA">Canceladas</option></select>
          <div className="flex gap-2"><select name="ordenar" defaultValue={ordenar} className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200"><option value="sequencia">Sequência</option><option value="liberacao">Liberação recente</option><option value="status">Status</option></select><button className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">Filtrar</button></div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Seq.</th>
              <th className="px-5 py-3">Lote</th>
              <th className="px-5 py-3">Modelo</th>
              <th className="px-5 py-3">Estoque regulador</th>
              <th className="px-5 py-3">Curva</th>
              <th className="px-5 py-3">Quantidade</th>
              <th className="px-5 py-3">Liberada em</th>
              <th className="px-5 py-3">Finalizada em</th>
              <th className="px-5 py-3">Tempo total</th>
              <th className="px-5 py-3">Status</th>
              <th className="w-16 px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {ops.map((op) => (
              <tr key={op.id} className="hover:bg-[#2C3645]">
                <td className="px-5 py-3 font-mono font-semibold text-slate-100">
                  {op.numeroSequencia}
                </td>
                <td className="px-5 py-3 font-mono text-slate-300">
                  {op.lote || <span className="text-slate-500">Sem lote</span>}
                </td>
                <td className="px-5 py-3 font-mono text-slate-300">
                  {op.modelo.codigo}
                </td>
                <td className="px-5 py-3">
                  <span className="font-mono text-slate-300">{op.modelo.estoqueMinimo ?? "—"}</span>
                </td>
                <td className="px-5 py-3">
                  <Badge
                    variant={
                      CURVA_VARIANT[op.modelo.curva as "A" | "B" | "C"] ??
                      "neutral"
                    }
                  >
                    {op.modelo.curva}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-slate-400">{op.quantidade}</td>
                <td className="px-5 py-3 text-slate-500">
                  {formatDate(op.dataLiberacao)}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {op.dataFinalizacao ? formatDate(op.dataFinalizacao) : "—"}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-cyan-200">
                  {formatDuracaoOP(op.dataLiberacao, op.dataFinalizacao)}
                </td>
                <td className="px-5 py-3">
                  <StatusSelect opId={op.id} status={op.status} />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/ops/${op.id}/documento`}
                      className="rounded-md border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-bold text-emerald-200 transition hover:border-emerald-200/60 hover:bg-emerald-400/20"
                    >
                      Ficha OP
                    </Link>
                    <Link
                      href={`/ops/${op.id}`}
                      className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-bold text-cyan-200 transition hover:border-cyan-200/60 hover:bg-cyan-400/20"
                    >
                      Abrir OP
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {ops.length === 0 && (
              <tr>
                <td colSpan={11} className="px-5 py-8 text-center text-slate-400">
                  Nenhuma OP liberada ainda.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-4 text-xs text-slate-400">
          <span>Página {Math.min(pagina, totalPaginas)} de {totalPaginas} · 25 por página</span>
          <div className="flex gap-2"><Link aria-disabled={pagina <= 1} className={`rounded border border-white/10 px-3 py-1.5 ${pagina <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white/5"}`} href={query(Math.max(1, pagina - 1))}>Anterior</Link><Link aria-disabled={pagina >= totalPaginas} className={`rounded border border-white/10 px-3 py-1.5 ${pagina >= totalPaginas ? "pointer-events-none opacity-40" : "hover:bg-white/5"}`} href={query(Math.min(totalPaginas, pagina + 1))}>Próxima</Link></div>
        </div>
      </Card>
    </div>
  );
}

function formatDuracaoOP(inicio: Date, fim: Date | null) {
  if (!fim) return "Em produção";
  const segundos = Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 1000));
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return [dias > 0 ? `${dias}d` : "", horas > 0 ? `${horas}h` : "", `${minutos}min`].filter(Boolean).join(" ");
}
