import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateRoteiro, deleteModelo } from "@/lib/actions/modelos";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/badge";
import { CURVA_VARIANT, TIPO_LABEL } from "@/lib/labels";

export default async function ModeloDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const modeloId = Number(id);

  const [modelo, setores] = await Promise.all([
    prisma.modelo.findUnique({
      where: { id: modeloId },
      include: { roteiro: true },
    }),
    prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } }),
  ]);

  if (!modelo) notFound();

  const ordemAtual = new Map(modelo.roteiro.map((r) => [r.setorId, r.ordem]));
  const boundUpdateRoteiro = updateRoteiro.bind(null, modelo.id);
  const boundDeleteModelo = deleteModelo.bind(null, modelo.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={modelo.codigo}
        subtitle="Roteiro de fabricação: por quais setores este engate passa e em que ordem."
        actions={
          <>
            <Badge variant={CURVA_VARIANT[modelo.curva as "A" | "B" | "C"] ?? "neutral"}>
              Curva {modelo.curva}
            </Badge>
            <Badge variant="neutral">{TIPO_LABEL[modelo.tipo] ?? modelo.tipo}</Badge>
            <Link
              href={`/registros/${modelo.id}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Ver ficha (foto, peças) →
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader
          title="Roteiro de fabricação"
          subtitle="Preencha a ordem (1, 2, 3...) apenas nos setores que este modelo utiliza. Deixe em branco para pular a etapa."
        />
        <form action={boundUpdateRoteiro} className="flex flex-col">
          <ul className="divide-y divide-white/5">
            {setores.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <span className="text-sm font-medium text-slate-200">
                  {s.nome}
                </span>
                <input
                  type="number"
                  min={0}
                  name={`ordem-${s.id}`}
                  defaultValue={ordemAtual.get(s.id) ?? ""}
                  placeholder="—"
                  className="w-20 rounded-md border border-white/5 px-2 py-1.5 text-center text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </li>
            ))}
          </ul>
          <div className="flex justify-end border-t border-white/5 px-5 py-4">
            <SubmitButton>Salvar roteiro</SubmitButton>
          </div>
        </form>
      </Card>

      <div className="flex justify-end">
        <form action={boundDeleteModelo}>
          <button
            type="submit"
            className="text-xs font-medium text-red-600 hover:text-red-800"
          >
            Excluir modelo
          </button>
        </form>
      </div>
    </div>
  );
}
