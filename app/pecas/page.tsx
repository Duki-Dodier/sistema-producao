import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { TIPO_MATERIAL_LABEL } from "@/lib/labels";
import { FileText, Plus } from "lucide-react";

export default async function PecasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim();
  const tipoMaterial = Object.prototype.hasOwnProperty.call(TIPO_MATERIAL_LABEL, sp.tipoMaterial ?? "") ? sp.tipoMaterial : "";
  const setorIdInformado = Number(sp.setorId);
  const setorId = Number.isInteger(setorIdInformado) && setorIdInformado > 0 ? setorIdInformado : null;
  const ordenar = ["codigo", "nome", "atualizacao"].includes(sp.ordenar ?? "") ? sp.ordenar : "codigo";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const porPagina = 25;
  const where = {
    ...(busca ? { OR: [{ codigo: { contains: busca } }, { nome: { contains: busca } }] } : {}),
    ...(tipoMaterial ? { tipoMaterial } : {}),
    ...(setorId ? { setorId } : {}),
  };
  const orderBy = ordenar === "nome"
    ? { nome: "asc" as const }
    : ordenar === "atualizacao"
      ? { updatedAt: "desc" as const }
      : { codigo: "asc" as const };
  const [totalPecas, pecas, setores] = await Promise.all([
    prisma.peca.count({ where }),
    prisma.peca.findMany({
      where,
      orderBy,
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        codigo: true,
        nome: true,
        medida: true,
        tipoMaterial: true,
        updatedAt: true,
        setor: { select: { id: true, nome: true } },
        _count: { select: { modelos: true, apontamentos: true } },
      },
    }),
    prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" }, select: { id: true, nome: true } }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(totalPecas / porPagina));
  const query = (nextPagina: number) => {
    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);
    if (tipoMaterial) params.set("tipoMaterial", tipoMaterial);
    if (setorId) params.set("setorId", String(setorId));
    if (ordenar !== "codigo") params.set("ordenar", ordenar);
    params.set("pagina", String(nextPagina));
    return `/pecas?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Peças e BOM"
        subtitle="Consulte os SKUs de peças usados nos modelos, seus setores e histórico de apontamentos."
        actions={<Link href="/modelos" className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3.5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"><Plus className="h-4 w-4" />Ver modelos</Link>}
      />
      <Card>
        <CardHeader title={`Peças cadastradas (${totalPecas})`} />
        <form method="get" className="grid gap-3 border-b border-white/5 bg-[#1a222c] p-4 md:grid-cols-5">
          <input name="busca" defaultValue={busca} placeholder="Buscar código ou descrição" className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200 placeholder-slate-500 md:col-span-2" />
          <select name="tipoMaterial" defaultValue={tipoMaterial} className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200"><option value="">Todos os materiais</option>{Object.entries(TIPO_MATERIAL_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select name="setorId" defaultValue={setorId ? String(setorId) : ""} className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200"><option value="">Todos os setores</option>{setores.map((setor) => <option key={setor.id} value={setor.id}>{setor.nome}</option>)}</select>
          <div className="flex gap-2"><select name="ordenar" defaultValue={ordenar} className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200"><option value="codigo">Código</option><option value="nome">Nome</option><option value="atualizacao">Atualização</option></select><button className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">Filtrar</button></div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Código</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3">Material</th><th className="px-5 py-3">Setor</th><th className="px-5 py-3">Modelos</th><th className="px-5 py-3">Apontamentos</th><th className="px-5 py-3" /></tr></thead>
            <tbody className="divide-y divide-white/5">
              {pecas.map((peca) => <tr key={peca.id} className="hover:bg-[#2c3645]"><td className="px-5 py-3 font-mono font-medium text-slate-100">{peca.codigo}</td><td className="max-w-[360px] px-5 py-3 text-slate-300"><div className="truncate" title={peca.nome}>{peca.nome}</div><div className="text-xs text-slate-500">{peca.medida || "Medida não informada"}</div></td><td className="px-5 py-3 text-slate-400">{peca.tipoMaterial ? TIPO_MATERIAL_LABEL[peca.tipoMaterial] ?? peca.tipoMaterial : "—"}</td><td className="px-5 py-3 text-slate-400">{peca.setor.nome}</td><td className="px-5 py-3 text-slate-400">{peca._count.modelos}</td><td className="px-5 py-3 text-slate-400">{peca._count.apontamentos}</td><td className="px-5 py-3 text-right"><Link href={`/registros/pecas/${peca.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/15"><FileText className="h-3.5 w-3.5" />Abrir peça</Link></td></tr>)}
              {pecas.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">Nenhuma peça encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-4 text-xs text-slate-400"><span>Página {Math.min(pagina, totalPaginas)} de {totalPaginas} · 25 por página</span><div className="flex gap-2"><Link aria-disabled={pagina <= 1} className={`rounded border border-white/10 px-3 py-1.5 ${pagina <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white/5"}`} href={query(Math.max(1, pagina - 1))}>Anterior</Link><Link aria-disabled={pagina >= totalPaginas} className={`rounded border border-white/10 px-3 py-1.5 ${pagina >= totalPaginas ? "pointer-events-none opacity-40" : "hover:bg-white/5"}`} href={query(Math.min(totalPaginas, pagina + 1))}>Próxima</Link></div></div>
      </Card>
    </div>
  );
}
