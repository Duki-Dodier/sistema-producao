import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { Badge } from "@/components/badge";
import { CURVA_VARIANT, TIPO_LABEL } from "@/lib/labels";
import { FileText, Plus, Route } from "lucide-react";

export default async function ModelosPage() {
  const modelos = await prisma.modelo.findMany({
    orderBy: { codigo: "asc" },
    select: {
      id: true,
      codigo: true,
      curva: true,
      tipo: true,
      _count: { select: { roteiro: true, ops: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Engenharia de Produto"
        subtitle="Consulte a ficha técnica, as peças e o fluxo de produção de cada modelo."
        actions={
          <Link
            href="/registros"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Novo modelo
          </Link>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Ficha técnica e peças</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Dados do modelo, fotos, materiais, medidas e quantidades necessárias.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-start gap-3">
            <Route className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Fluxo de produção</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Define por quais setores a OP passa e em qual sequência os apontamentos são liberados.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader title={`Modelos cadastrados (${modelos.length})`} />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Código</th>
              <th className="px-5 py-3">Curva</th>
              <th className="px-5 py-3">Tipo</th>
              <th className="px-5 py-3">Fluxo de produção</th>
              <th className="px-5 py-3">OPs</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {modelos.map((m) => (
              <tr key={m.id} className="hover:bg-[#2C3645]">
                <td className="px-5 py-3 font-mono font-medium text-slate-100">
                  {m.codigo}
                </td>
                <td className="px-5 py-3">
                  <Badge variant={CURVA_VARIANT[m.curva as "A" | "B" | "C"] ?? "neutral"}>
                    Curva {m.curva}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-slate-400">
                  {TIPO_LABEL[m.tipo] ?? m.tipo}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {m._count.roteiro > 0
                    ? `${m._count.roteiro} etapas configuradas`
                    : "Fluxo não configurado"}
                </td>
                <td className="px-5 py-3 text-slate-500">{m._count.ops}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                    <Link
                      href={`/registros/${m.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Abrir ficha técnica
                    </Link>
                    <Link
                      href={`/modelos/${m.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/15"
                    >
                      <Route className="h-3.5 w-3.5" />
                      Configurar fluxo
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {modelos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  Nenhum modelo cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
