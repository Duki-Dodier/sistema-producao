import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { calcularRastreamento } from "@/lib/rastreamento";
import { ehSetorFinal } from "@/lib/setores";
import { calcularPrioridadesPrePronto } from "@/lib/prioridades-pre-pronto";
import { PreProntoPriorityReport } from "@/components/pre-pronto-priority-report";

export default async function PrioridadesPreProntoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim().toLowerCase();
  const setores = await prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } });
  const setoresProdutivos = setores.filter((setor) => !ehSetorFinal(setor.nome));
  const setorInformado = sp.prioridadeSetor ? Number(sp.prioridadeSetor) : null;
  const setorId = Number.isInteger(setorInformado) && setoresProdutivos.some((setor) => setor.id === setorInformado)
    ? setorInformado
    : setoresProdutivos[0]?.id ?? null;

  const ops = await prisma.oP.findMany({
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
    orderBy: { numeroSequencia: "asc" },
  });

  const rastreamento = calcularRastreamento(ops).filter((item) => {
    if (!busca) return true;
    const alvo = `${item.op.numeroSequencia} ${item.op.lote ?? ""} ${item.op.modelo.codigo} ${item.op.modelo.nome ?? ""}`.toLowerCase();
    return alvo.includes(busca);
  });
  const prioridades = setorId
    ? calcularPrioridadesPrePronto(rastreamento, setorId)
    : [];

  return (
    <div className="flex min-h-full w-full flex-col gap-5 bg-[#0b1326] p-6 print:bg-white">
      <div className="print:hidden">
        <PageHeader
          title="Prioridades para fechar pré-pronto"
          subtitle="Relatório prático para imprimir e entregar aos líderes dos setores."
          actions={
            <Link
              href="/monitoramento"
              className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/20"
            >
              ← Voltar para ordens
            </Link>
          }
        />
      </div>

      <PreProntoPriorityReport
        itens={prioridades}
        setorId={setorId}
        setores={setoresProdutivos.map((setor) => ({ id: setor.id, nome: setor.nome }))}
        busca={sp.busca ?? ""}
      />
    </div>
  );
}
