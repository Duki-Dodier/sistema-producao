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
        status: true,
        modelo: { select: { codigo: true, curva: true } },
      },
    }),
    prisma.modelo.findMany({
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, curva: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <PageHeader
        title="Ordens de Produção"
        subtitle="A sequência (0–1000) é a prioridade de liberação — vale em todos os setores."
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
        {modelos.length === 0 && (
          <p className="px-5 pb-4 text-xs text-amber-700">
            Cadastre ao menos um modelo antes de liberar uma OP.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title={`OPs (${ops.length})`} />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Seq.</th>
              <th className="px-5 py-3">Lote</th>
              <th className="px-5 py-3">Modelo</th>
              <th className="px-5 py-3">Curva</th>
              <th className="px-5 py-3">Quantidade</th>
              <th className="px-5 py-3">Liberada em</th>
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
                <td className="px-5 py-3">
                  <StatusSelect opId={op.id} status={op.status} />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/ops/${op.id}/documento`}
                      className="text-xs font-medium text-emerald-500 hover:text-emerald-400"
                    >
                      Documento
                    </Link>
                    <Link
                      href={`/ops/${op.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {ops.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  Nenhuma OP liberada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
