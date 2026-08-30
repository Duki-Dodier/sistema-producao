import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";

const ENTIDADES = ["MODELO", "BOM", "ROTEIRO", "ESTOQUE", "OP", "NEST", "FUNCIONARIO"];

export default async function HistoricoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim();
  const entidade = ENTIDADES.includes(sp.entidade ?? "") ? sp.entidade : "";
  const dataInicio = /^\d{4}-\d{2}-\d{2}$/.test(sp.inicio ?? "") ? new Date(`${sp.inicio}T00:00:00`) : null;
  const dataFim = /^\d{4}-\d{2}-\d{2}$/.test(sp.fim ?? "") ? new Date(`${sp.fim}T23:59:59.999`) : null;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const porPagina = 30;
  const where = { ...(entidade ? { entidade } : {}), ...(busca ? { OR: [{ descricao: { contains: busca } }, { usuario: { contains: busca } }] } : {}), ...(dataInicio || dataFim ? { dataHora: { ...(dataInicio ? { gte: dataInicio } : {}), ...(dataFim ? { lte: dataFim } : {}) } } : {}) };
  const [total, registros] = await Promise.all([
    prisma.historicoAlteracao.count({ where }),
    prisma.historicoAlteracao.findMany({ where, orderBy: { dataHora: "desc" }, skip: (pagina - 1) * porPagina, take: porPagina }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const query = (p: number) => { const q = new URLSearchParams(); if (busca) q.set("busca", busca); if (entidade) q.set("entidade", entidade); if (sp.inicio) q.set("inicio", sp.inicio); if (sp.fim) q.set("fim", sp.fim); q.set("pagina", String(p)); return `/historico?${q.toString()}`; };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Histórico geral de alterações" subtitle="Rastreabilidade de modelos, BOM, roteiros, estoque, OPs, NESTs e funcionários." />
      <Card>
        <CardHeader title={`${total} alterações registradas`} />
        <form method="get" className="grid gap-3 border-b border-white/5 bg-[#1a222c] p-4 md:grid-cols-5">
          <input name="busca" defaultValue={busca} placeholder="Buscar descrição ou usuário" className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200 placeholder-slate-500 md:col-span-2" />
          <select name="entidade" defaultValue={entidade} className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200"><option value="">Todas as áreas</option>{ENTIDADES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <input type="date" name="inicio" defaultValue={sp.inicio ?? ""} className="rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200" />
          <div className="flex gap-2"><input type="date" name="fim" defaultValue={sp.fim ?? ""} className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#0b101e] px-3 py-2 text-sm text-slate-200" /><button className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">Filtrar</button></div>
        </form>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-5 py-3">Data</th><th className="px-5 py-3">Área</th><th className="px-5 py-3">Ação</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3">Usuário</th></tr></thead><tbody className="divide-y divide-white/5">{registros.map((item) => <tr key={item.id} className="hover:bg-[#2c3645]"><td className="whitespace-nowrap px-5 py-3 text-slate-500">{new Date(item.dataHora).toLocaleString("pt-BR")}</td><td className="px-5 py-3 font-semibold text-cyan-300">{item.entidade}</td><td className="px-5 py-3 text-slate-300">{item.acao}</td><td className="px-5 py-3 text-slate-300">{item.descricao}</td><td className="px-5 py-3 text-slate-400">{item.usuario}</td></tr>)}{registros.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Nenhuma alteração encontrada.</td></tr>}</tbody></table></div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-4 text-xs text-slate-400"><span>Página {Math.min(pagina, totalPaginas)} de {totalPaginas}</span><div className="flex gap-2"><Link className={`rounded border border-white/10 px-3 py-1.5 ${pagina <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white/5"}`} href={query(Math.max(1, pagina - 1))}>Anterior</Link><Link className={`rounded border border-white/10 px-3 py-1.5 ${pagina >= totalPaginas ? "pointer-events-none opacity-40" : "hover:bg-white/5"}`} href={query(Math.min(totalPaginas, pagina + 1))}>Próxima</Link></div></div>
      </Card>
    </div>
  );
}
