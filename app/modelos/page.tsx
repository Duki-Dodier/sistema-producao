import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { Badge } from "@/components/badge";
import { CURVA_VARIANT, TIPO_LABEL } from "@/lib/labels";
import { FileText, Plus, Route } from "lucide-react";

export default async function ModelosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim();
  const curva = ["A", "B", "C"].includes(sp.curva ?? "") ? sp.curva : "";
  const tipo = ["FIXO", "REMOVIVEL", "PONTEIRA_MACHO"].includes(sp.tipo ?? "") ? sp.tipo : "";
  const linha = ["BRUCKE", "REFORCEL"].includes(sp.linha ?? "") ? sp.linha : "";
  const ordenar = ["codigo", "estoque", "ops", "data"].includes(sp.ordenar ?? "") ? sp.ordenar : "codigo";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const porPagina = 25;
  const where = {
    ...(busca ? { OR: [{ codigo: { contains: busca } }, { nome: { contains: busca } }] } : {}),
    ...(curva ? { curva } : {}),
    ...(tipo ? { tipo } : {}),
    ...(linha ? { linhaProduto: linha } : {}),
  };
  const orderBy = ordenar === "estoque"
    ? { estoqueMinimo: "desc" as const }
    : ordenar === "ops"
      ? { ops: { _count: "desc" as const } }
    : ordenar === "data"
      ? { updatedAt: "desc" as const }
      : { codigo: "asc" as const };
  const [totalModelos, modelos] = await Promise.all([
    prisma.modelo.count({ where }),
    prisma.modelo.findMany({
      where,
      orderBy,
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        codigo: true,
        curva: true,
        tipo: true,
        linhaProduto: true,
        estoqueMinimo: true,
        updatedAt: true,
        _count: { select: { ops: true } },
      },
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(totalModelos / porPagina));
  const query = (nextPagina: number) => {
    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);
    if (curva) params.set("curva", curva);
    if (tipo) params.set("tipo", tipo);
    if (linha) params.set("linha", linha);
    if (ordenar !== "codigo") params.set("ordenar", ordenar);
    params.set("pagina", String(nextPagina));
    return `/modelos?${params.toString()}`;
  };

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
        <CardHeader title={`Modelos cadastrados (${totalModelos})`} />
        <form method="get" className="grid gap-3 border-b border-white/5 bg-[#1a222c] p-4 md:grid-cols-6">
          <input name="busca" defaultValue={busca} placeholder="Buscar código ou descrição" className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200 placeholder-slate-500 md:col-span-2" />
          <select name="curva" defaultValue={curva} className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200"><option value="">Todas as curvas</option><option value="A">Curva A</option><option value="B">Curva B</option><option value="C">Curva C</option></select>
          <select name="tipo" defaultValue={tipo} className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200"><option value="">Todos os tipos</option><option value="FIXO">Fixo</option><option value="REMOVIVEL">Removível</option><option value="PONTEIRA_MACHO">Ponteira macho</option></select>
          <select name="linha" defaultValue={linha} className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200"><option value="">Todas as linhas</option><option value="BRUCKE">Brucke</option><option value="REFORCEL">Reforcel</option></select>
          <div className="flex gap-2"><select name="ordenar" defaultValue={ordenar} className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200"><option value="codigo">Código</option><option value="estoque">Estoque</option><option value="ops">OPs vinculadas</option><option value="data">Atualização</option></select><button className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">Filtrar</button></div>
        </form>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Código</th>
              <th className="px-5 py-3">Curva</th>
              <th className="px-5 py-3">Tipo</th>
              <th className="px-5 py-3">Linha</th>
              <th className="px-5 py-3">Estoque regulador</th>
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
                <td className="px-5 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant="neutral">{m.linhaProduto}</Badge>
                    <span className="text-[10px] text-slate-600">Definida no cadastro</span>
                  </div>
                </td>
                <td className="px-5 py-3 font-mono text-slate-400">{m.estoqueMinimo ?? "—"}</td>
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
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  Nenhum modelo cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-4 text-xs text-slate-400">
          <span>Página {Math.min(pagina, totalPaginas)} de {totalPaginas} · 25 por página</span>
          <div className="flex gap-2"><Link aria-disabled={pagina <= 1} className={`rounded border border-white/10 px-3 py-1.5 ${pagina <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white/5"}`} href={query(Math.max(1, pagina - 1))}>Anterior</Link><Link aria-disabled={pagina >= totalPaginas} className={`rounded border border-white/10 px-3 py-1.5 ${pagina >= totalPaginas ? "pointer-events-none opacity-40" : "hover:bg-white/5"}`} href={query(Math.min(totalPaginas, pagina + 1))}>Próxima</Link></div>
        </div>
      </Card>
    </div>
  );
}
