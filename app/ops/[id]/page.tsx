import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateOP } from "@/lib/actions/ops";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { SubmitButton } from "@/components/submit-button";
import { STATUS_OP_LABEL } from "@/lib/labels";
import { DeleteOPForm } from "@/components/delete-op-form";
import { ehSetor } from "@/lib/setores";

export default async function OPDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opId = Number(id);

  const [op, modelos, totalApontamentos] = await Promise.all([
    prisma.oP.findUnique({
      where: { id: opId },
      include: {
        modelo: {
          include: {
            roteiro: {
              orderBy: { ordem: "asc" },
              include: { setor: true },
            },
          },
        },
      },
    }),
    prisma.modelo.findMany({ orderBy: { codigo: "asc" } }),
    prisma.apontamento.count({ where: { opId } }),
  ]);

  if (!op) notFound();

  const boundUpdate = updateOP.bind(null, op.id);
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
              className="rounded-md border border-white/5 bg-[#1A222C] px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

      <Card>
        <CardHeader
          title={`Fluxo da OP · ${op.modelo.codigo}`}
          subtitle="A preparação termina no Agrupamento. Depois o conjunto segue para Solda, Pintura e Montagem."
        />
        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          {op.modelo.roteiro.map((etapa) => {
            const final = ["Agrupamento", "Solda", "Pintura", "Montagem"].some((nome) =>
              ehSetor(etapa.setor.nome, nome),
            );
            return (
              <div key={etapa.id} className="flex items-center gap-2">
                <span
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    final
                      ? "border-amber-300/30 bg-amber-400/10 text-amber-200"
                      : "border-cyan-300/25 bg-cyan-400/10 text-cyan-200"
                  }`}
                >
                  <span className="mr-1 font-mono text-[10px] opacity-70">{etapa.ordem}.</span>
                  {etapa.setor.nome}
                </span>
                {etapa.ordem < op.modelo.roteiro.length && (
                  <span className="text-slate-600">→</span>
                )}
              </div>
            );
          })}
          {op.modelo.roteiro.length === 0 && (
            <p className="text-xs text-amber-200">Este modelo ainda não possui roteiro cadastrado.</p>
          )}
        </div>
      </Card>

      <DeleteOPForm opId={op.id} temApontamentos={totalApontamentos > 0} />
    </div>
  );
}
