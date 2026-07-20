import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createSetor, deleteSetor } from "@/lib/actions/setores";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { SubmitButton } from "@/components/submit-button";

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
        subtitle="Os setores fixos do fluxo de produção. A ordem define a exibição no roteiro e no painel."
      />

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
