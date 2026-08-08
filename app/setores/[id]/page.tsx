import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calcularProgressoOPs } from "@/lib/pcp";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/badge";
import { CURVA_VARIANT } from "@/lib/labels";
import { definicaoSetor } from "@/lib/setores";

export default async function SetorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const setorId = Number(id);

  const [setor, ops, totalHistorico] = await Promise.all([
    prisma.setor.findUnique({ where: { id: setorId } }),
    prisma.oP.findMany({
      where: { status: "ABERTA" },
      include: {
        modelo: {
          include: {
            roteiro: { include: { setor: true }, orderBy: { ordem: "asc" } },
            pecas: {
              include: {
                peca: {
                  include: {
                    roteiro: { include: { setor: true }, orderBy: { ordem: "asc" } },
                  },
                },
              },
            },
          },
        },
        apontamentos: true,
      },
    }),
    prisma.apontamento.aggregate({
      where: { setorId },
      _sum: { quantidadeBoa: true },
      _count: true,
    }),
  ]);

  if (!setor) notFound();

  const progresso = calcularProgressoOPs(ops)
    .map((p) => ({
      ...p,
      setorAqui: p.setores.find((s) => s.setorId === setorId) ?? null,
    }))
    .filter((p) => p.setorAqui !== null)
    .sort((a, b) => a.op.numeroSequencia - b.op.numeroSequencia);

  const pendentes = progresso.filter((p) => !p.setorAqui!.completo);
  const gargalo = progresso.filter((p) => p.setorAtual?.setorId === setorId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={setor.nome}
        subtitle={`${definicaoSetor(setor.nome)?.descricao ?? "Setor de produção"} Ordem ${setor.ordemPadrao} no fluxo.`}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="OPs com peças neste setor" value={progresso.length} />
        <StatCard
          label="Pendentes"
          value={pendentes.length}
          accent={pendentes.length > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="É o gargalo de"
          value={gargalo.length}
          accent={gargalo.length > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Produzido (histórico)"
          value={totalHistorico._sum.quantidadeBoa ?? 0}
          accent="success"
        />
      </div>

      <Card>
        <CardHeader
          title="OPs neste setor"
          subtitle="Ordenadas pela sequência de liberação (0–1000)."
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Seq.</th>
              <th className="px-5 py-3">Modelo</th>
              <th className="px-5 py-3">Curva</th>
              <th className="px-5 py-3">Produzido</th>
              <th className="px-5 py-3">Falta</th>
              <th className="px-5 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {progresso.map((p) => (
              <tr key={p.op.id} className="hover:bg-[#2C3645]">
                <td className="px-5 py-3 font-mono font-semibold text-slate-100">
                  {p.op.numeroSequencia}
                </td>
                <td className="px-5 py-3 font-mono text-slate-300">
                  {p.op.modelo.codigo}
                </td>
                <td className="px-5 py-3">
                  <Badge
                    variant={
                      CURVA_VARIANT[p.op.modelo.curva as "A" | "B" | "C"] ?? "neutral"
                    }
                  >
                    {p.op.modelo.curva}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-slate-400">
                  {p.setorAqui!.quantidadeBoa}
                </td>
                <td className="px-5 py-3 text-slate-400">
                  {p.setorAqui!.falta}
                </td>
                <td className="px-5 py-3">
                  {p.setorAqui!.completo ? (
                    <Badge variant="success">Concluído</Badge>
                  ) : p.setorAtual?.setorId === setorId ? (
                    <Badge variant="warning">Gargalo atual</Badge>
                  ) : (
                    <Badge variant="neutral">Pendente</Badge>
                  )}
                </td>
              </tr>
            ))}
            {progresso.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  Nenhuma OP aberta passa por este setor no momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
