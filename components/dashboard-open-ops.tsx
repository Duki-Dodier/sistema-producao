"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/badge";
import { Card, CardHeader } from "@/components/card";
import { ProgressBar } from "@/components/progress-bar";
import { CURVA_VARIANT } from "@/lib/labels";

const POR_PAGINA = 10;

export type DashboardOpenOpItem = {
  id: number;
  sequencia: number;
  codigo: string;
  nome: string | null;
  estoqueRegulador: number | null;
  curva: string;
  setorAtual: string | null;
  percentual: number;
  doneCount: number;
  totalCount: number;
  quantidade: number;
  liberadaEm: string;
};

type Ordenacao = "sequencia" | "antigas" | "proximas" | "maior";

export function DashboardOpenOps({ itens }: { itens: DashboardOpenOpItem[] }) {
  const [busca, setBusca] = useState("");
  const [classe, setClasse] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("sequencia");
  const [pagina, setPagina] = useState(1);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens
      .filter((item) => {
        if (classe && item.curva !== classe) return false;
        if (!termo) return true;
        return `${item.sequencia} ${item.codigo} ${item.nome ?? ""} ${item.setorAtual ?? ""}`
          .toLowerCase()
          .includes(termo);
      })
      .sort((a, b) => {
        if (ordenacao === "antigas") return tempoAberto(b, agora) - tempoAberto(a, agora);
        if (ordenacao === "proximas") return b.percentual - a.percentual || a.sequencia - b.sequencia;
        if (ordenacao === "maior") return b.quantidade - a.quantidade || a.sequencia - b.sequencia;
        return a.sequencia - b.sequencia;
      });
  }, [agora, busca, classe, itens, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <Card>
      <CardHeader
        title={`OPs abertas (${filtrados.length}${filtrados.length !== itens.length ? ` de ${itens.length}` : ""})`}
        subtitle="Pesquise, ordene e acompanhe a conclusão sem perder as informações do produto."
      />
      <div className="flex flex-wrap items-end gap-3 border-b border-white/5 px-5 py-4">
        <label className="flex min-w-[230px] flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Buscar nesta lista</span>
          <input
            value={busca}
            onChange={(event) => { setBusca(event.target.value); setPagina(1); }}
            placeholder="Seq., código, produto ou setor"
            className="rounded-md border border-white/10 bg-[#0D1524] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400"
          />
        </label>
        <label className="flex w-28 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Classe</span>
          <select value={classe} onChange={(event) => { setClasse(event.target.value); setPagina(1); }} className="rounded-md border border-white/10 bg-[#0D1524] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400">
            <option value="">Todas</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </label>
        <label className="flex min-w-[190px] flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ordenar por</span>
          <select value={ordenacao} onChange={(event) => { setOrdenacao(event.target.value as Ordenacao); setPagina(1); }} className="rounded-md border border-white/10 bg-[#0D1524] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-400">
            <option value="sequencia">Sequência</option>
            <option value="antigas">Mais tempo aberta</option>
            <option value="proximas">Mais próxima de concluir</option>
            <option value="maior">Maior quantidade</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-[10px] font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Seq.</th>
              <th className="px-5 py-3">Código / produto</th>
              <th className="px-5 py-3">Estoque regulador</th>
              <th className="px-5 py-3">ABC</th>
              <th className="px-5 py-3">Etapa atual</th>
              <th className="px-5 py-3">Conclusão</th>
              <th className="px-5 py-3">Tempo aberto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visiveis.map((item) => (
              <tr key={item.id} className="hover:bg-white/[.025]">
                <td className="px-5 py-3 font-mono font-semibold text-slate-100">{item.sequencia}</td>
                <td className="max-w-[300px] px-5 py-3">
                  <Link href={`/ops/${item.id}`} className="font-mono text-cyan-300 hover:text-cyan-200">{item.codigo}</Link>
                  <p className="truncate text-[11px] text-slate-500">{item.nome ?? "Produto sem descrição"}</p>
                </td>
                <td className="px-5 py-3 font-mono text-slate-300">{item.estoqueRegulador ?? "—"}</td>
                <td className="px-5 py-3">
                  <Badge variant={CURVA_VARIANT[item.curva as "A" | "B" | "C"] ?? "neutral"}>{item.curva}</Badge>
                </td>
                <td className="px-5 py-3 text-xs text-slate-400">{item.setorAtual ?? "Pronta para finalizar"}</td>
                <td className="w-48 px-5 py-3">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                    <span>{item.doneCount}/{item.totalCount} etapas</span>
                    <span className="font-mono font-semibold text-slate-200">{item.percentual}%</span>
                  </div>
                  <div className="mt-1.5"><ProgressBar percentual={item.percentual} variant={item.percentual >= 100 ? "success" : "default"} /></div>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-amber-200">{formatarDuracao(tempoAberto(item, agora))}</td>
              </tr>
            ))}
            {visiveis.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma OP encontrada nesta lista.</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} totalItens={filtrados.length} onChange={setPagina} />
    </Card>
  );
}

function tempoAberto(item: DashboardOpenOpItem, agora: number) {
  return Math.max(0, Math.floor((agora - new Date(item.liberadaEm).getTime()) / 1000));
}

function formatarDuracao(segundos: number) {
  const dias = Math.floor(segundos / 86_400);
  const horas = Math.floor((segundos % 86_400) / 3_600);
  const minutos = Math.floor((segundos % 3_600) / 60);
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${Math.max(1, minutos)}min`;
}

function Paginacao({ pagina, totalPaginas, totalItens, onChange }: { pagina: number; totalPaginas: number; totalItens: number; onChange: (pagina: number) => void }) {
  const inicio = totalItens === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;
  const fim = Math.min(pagina * POR_PAGINA, totalItens);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
      <span className="text-[11px] text-slate-500">Mostrando {inicio}–{fim} de {totalItens} · 10 por página</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={pagina <= 1} onClick={() => onChange(pagina - 1)} className="rounded border border-white/10 px-3 py-1.5 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/5">Anterior</button>
        <span className="font-mono text-xs text-slate-500">{pagina}/{totalPaginas}</span>
        <button type="button" disabled={pagina >= totalPaginas} onClick={() => onChange(pagina + 1)} className="rounded border border-white/10 px-3 py-1.5 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white/5">Próxima</button>
      </div>
    </div>
  );
}
