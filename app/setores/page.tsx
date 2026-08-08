import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSetor, deleteSetor } from "@/lib/actions/setores";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { SubmitButton } from "@/components/submit-button";
import { definicaoSetor } from "@/lib/setores";

export default async function SetoresPage() {
  const setores = await prisma.setor.findMany({
    orderBy: { ordemPadrao: "asc" },
    include: {
      _count: { select: { roteiros: true, apontamentos: true, pecas: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Setores"
        subtitle="A fábrica está dividida em preparação de peças, Agrupamento e linha final. A ordem define o fluxo mostrado nas OPs e no monitoramento."
      />

      <div className="grid gap-3 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-4 text-xs text-slate-300 md:grid-cols-2">
        <div>
          <p className="font-bold uppercase tracking-wide text-cyan-200">Preparação / pré-pronto</p>
          <p className="mt-1 text-slate-400">Tubo, Plasma Chapa, Plasma Tubo, componentes, Ponteira e Acessórios.</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide text-amber-200">Fluxo final</p>
          <p className="mt-1 text-slate-400">Agrupamento recebe e guarda as peças antes de Solda, Pintura e Montagem.</p>
        </div>
      </div>

      <Card>
        <CardHeader title="Novo setor" />
        <form action={createSetor} className="flex items-end gap-3 px-5 py-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Nome do setor
            </label>
            <input
              name="nome"
              required
              placeholder="Ex.: Solda"
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex w-32 flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">
              Ordem
            </label>
            <input
              name="ordemPadrao"
              type="number"
              defaultValue={setores.length + 1}
              className="rounded-md border border-white/5 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <SubmitButton>Adicionar</SubmitButton>
        </form>
      </Card>

      <Card>
        <CardHeader
          title={`Setores cadastrados (${setores.length})`}
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="w-16 px-5 py-3">Ordem</th>
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">Em uso</th>
              <th className="w-24 px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {setores.map((s) => {
              const definicao = definicaoSetor(s.nome);
              const emUso =
                s._count.roteiros + s._count.apontamentos + s._count.pecas > 0;
              const remove = deleteSetor.bind(null, s.id);
              return (
                <tr key={s.id} className="hover:bg-[#2C3645]">
                  <td className="px-5 py-3 font-mono text-slate-500">
                    {s.ordemPadrao}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-100">
                    <Link href={`/setores/${s.id}`} className="hover:text-blue-600 hover:underline">
                      {s.nome}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className={`rounded px-1.5 py-0.5 font-bold uppercase tracking-wide ${
                        definicao?.grupo === "FLUXO_FINAL"
                          ? "bg-amber-400/10 text-amber-200"
                          : "bg-cyan-400/10 text-cyan-200"
                      }`}>
                        {definicao?.grupo === "FLUXO_FINAL" ? "Fluxo final" : "Preparação"}
                      </span>
                      <span className="font-normal text-slate-500">{definicao?.descricao ?? "Setor configurável"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {emUso
                      ? `${s._count.roteiros} roteiro(s) · ${s._count.apontamentos} apontamento(s) · ${s._count.pecas} peça(s)`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <form action={remove}>
                      <button
                        type="submit"
                        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:text-slate-300"
                        disabled={emUso}
                        title={
                          emUso
                            ? "Remova o setor dos roteiros/apontamentos/peças antes de excluir"
                            : "Excluir"
                        }
                      >
                        Excluir
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {setores.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                  Nenhum setor cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
