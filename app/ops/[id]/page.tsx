import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateOP, deleteOP } from "@/lib/actions/ops";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { SubmitButton } from "@/components/submit-button";
import { STATUS_OP_LABEL } from "@/lib/labels";

export default async function OPDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opId = Number(id);

  const [op, modelos] = await Promise.all([
    prisma.oP.findUnique({ where: { id: opId } }),
    prisma.modelo.findMany({ orderBy: { codigo: "asc" } }),
  ]);

  if (!op) notFound();

  const boundUpdate = updateOP.bind(null, op.id);
  const boundDelete = deleteOP.bind(null, op.id);
  const dataISO = op.dataLiberacao.toISOString().slice(0, 10);
  const previsaoISO = op.previsaoEntrega ? op.previsaoEntrega.toISOString().slice(0, 10) : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Editar OP ${op.numeroSequencia}`}
        subtitle="Ajuste os dados da ordem de produção."
      />

      <Card>
        <CardHeader title="Dados da OP" />
        <form action={boundUpdate} className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="flex w-32 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Nº sequência
            </label>
            <input
              name="numeroSequencia"
              type="number"
              min={0}
              max={1000}
              required
              defaultValue={op.numeroSequencia}
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
              defaultValue={op.lote ?? ""}
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
              defaultValue={op.modeloId}
              className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
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
              defaultValue={op.quantidade}
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex w-40 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Data</label>
            <input
              name="dataLiberacao"
              type="date"
              defaultValue={dataISO}
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex w-40 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Previsão entrega</label>
            <input
              name="previsaoEntrega"
              type="date"
              defaultValue={previsaoISO}
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex w-40 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Status
            </label>
            <select
              name="status"
              defaultValue={op.status}
              className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm text-slate-200 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(STATUS_OP_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton>Salvar</SubmitButton>
        </form>
      </Card>

      <div className="flex justify-end">
        <form action={boundDelete}>
          <button
            type="submit"
            className="text-xs font-medium text-red-600 hover:text-red-800"
          >
            Excluir OP
          </button>
        </form>
      </div>
    </div>
  );
}
