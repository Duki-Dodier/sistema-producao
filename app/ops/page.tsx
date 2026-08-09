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

export default async function OpsPage() {
  const [ops, modelos] = await Promise.all([
    prisma.oP.findMany({
      orderBy: { numeroSequencia: "asc" },
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
            curva: true,
          },
        },
      },
    }),
    prisma.modelo.findMany({
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, curva: true },
    }),
  ]);

  return (
    <div className="flex w-full flex-col gap-6 p-3 sm:p-6">
      <PageHeader
        title="Ordens de Produção"
        subtitle="A OP percorre os setores de preparação, passa pelo Agrupamento e segue para Solda, Pintura e Montagem."
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
                  {m.codigo} · Curva {m.curva}
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
        <CardHeader title={`OPs (${ops.length})`} subtitle="Altere o status conforme a situação real da ordem." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Seq.</th>
              <th className="px-5 py-3">Lote</th>
              <th className="px-5 py-3">Modelo</th>
              <th className="px-5 py-3">Curva</th>
              <th className="px-5 py-3">Quantidade</th>
              <th className="px-5 py-3">Liberada em</th>
              <th className="px-5 py-3">Finalizada em</th>
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
                <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                  Nenhuma OP liberada ainda.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
