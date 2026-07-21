import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateRoteiro } from "@/lib/actions/modelos";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/badge";
import { CURVA_VARIANT, TIPO_LABEL } from "@/lib/labels";
import { ArrowLeft, FileText, Info, Route } from "lucide-react";

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Fluxo de produção · ${modelo.codigo}`}
        subtitle="Defina a sequência de setores usada pelas OPs deste modelo."
        actions={
          <>
            <Badge variant={CURVA_VARIANT[modelo.curva as "A" | "B" | "C"] ?? "neutral"}>
              Curva {modelo.curva}
            </Badge>
            <Badge variant="neutral">{TIPO_LABEL[modelo.tipo] ?? modelo.tipo}</Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-4">
        <Link
          href="/modelos"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para Engenharia
        </Link>
        <span className="h-4 w-px bg-white/10" />
        <Link
          href={`/registros/${modelo.id}`}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <FileText className="h-3.5 w-3.5" />
          Ficha técnica e peças
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-300">
          <Route className="h-3.5 w-3.5" />
          Fluxo de produção
        </span>
      </div>

      <div className="flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <p className="text-sm font-semibold text-slate-100">Esta configuração interfere na produção</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            A sequência abaixo define onde as OPs aparecem, quais setores podem fazer apontamentos e a ordem exibida no monitoramento.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Sequência dos setores"
          subtitle="Informe 1 para a primeira etapa, 2 para a segunda e assim por diante. Deixe vazio o setor que não participa deste fluxo."
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
            <SubmitButton>Salvar fluxo de produção</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
