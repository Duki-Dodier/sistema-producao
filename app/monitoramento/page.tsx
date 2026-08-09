import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  calcularProgressoOPs,
  colunasRoteiro,
  type OPProgresso,
} from "@/lib/pcp";
import { createApontamento } from "@/lib/actions/apontamentos";
import { updateSetorConfig } from "@/lib/actions/setores";
import { Badge } from "@/components/badge";
import { SubmitButton } from "@/components/submit-button";
import { CURVA_VARIANT } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { MonitorApontamentoForm } from "@/components/monitor-apontamento-form";
import { ehSetor } from "@/lib/setores";
import { calcularRastreamento } from "@/lib/rastreamento";
import { OPTrackingBoard } from "@/components/op-tracking-board";
import { processosDaPeca } from "@/lib/processos";

// Paleta "Cyber-Industrial" (DESIGN.md): fundo deep slate, ciano neon p/ dados
// vivos, laranja p/ atenção, esmeralda p/ concluído. Números sempre em mono.
const C = {
  bg: "#0b1326",
  card: "#131b2e",
  cardHigh: "#171f33",
  border: "#2d3449",
  cyan: "#4cd7f6",
};

const INPUT_CLS =
  "rounded bg-[#060e20] border border-[#3d494c] px-3 py-2 text-sm text-[#dae2fd] placeholder-slate-600 focus:border-[#4cd7f6] focus:outline-none transition-colors";

export default async function MonitoramentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const visao = sp.visao === "setor" ? "setor" : "ops";

  const setores = await prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } });

  return (
    <div className="flex min-h-full w-full flex-col gap-5 p-6" style={{ background: C.bg }}>
      {/* Cabeçalho + troca de visão */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#dae2fd]">
            Monitoramento
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-500">
            {visao === "setor"
              ? "Cockpit de produção · dias × operadores"
              : "OPs · componentes · processos internos"}
          </p>
        </div>
        <div className="flex gap-2">
          <TabLink href="/monitoramento" active={visao === "ops"}>
            OPs e componentes
          </TabLink>
          <TabLink href="/monitoramento?visao=setor" active={visao === "setor"}>
            Produção por setor
          </TabLink>
          <TabLink href="/monitoramento/fluxo" active={false}>
            Mapa da fábrica →
          </TabLink>
        </div>
      </div>

      {visao === "setor" ? (
        <CockpitSetor sp={sp} setores={setores} />
      ) : (
        <RastreamentoOPs sp={sp} setores={setores} />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-all ${
        active
          ? "border border-[#4cd7f6] bg-[#4cd7f6]/10 text-[#4cd7f6] shadow-[0_0_10px_rgba(76,215,246,0.25)]"
          : "border border-[#2d3449] bg-[#131b2e] text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}

/* ============================================================
   VISÃO 1 — COCKPIT POR SETOR (dias do mês × operadores)
   ============================================================ */

async function CockpitSetor({
  sp,
  setores,
}: {
  sp: Record<string, string | undefined>;
  setores: Awaited<ReturnType<typeof prisma.setor.findMany>>;
}) {
  if (sp.setor === "geral") {
    return <CockpitGeralSetores sp={sp} setores={setores} />;
  }

  const setorId = sp.setor ? Number(sp.setor) : setores[0]?.id;
  const setor = setores.find((s) => s.id === setorId) ?? setores[0];
  if (!setor) {
    return (
      <p className="py-10 text-center text-slate-500">
        Nenhum setor cadastrado ainda.
      </p>
    );
  }

  // Mês selecionado (YYYY-MM), padrão = mês atual.
  const hoje = new Date();
  const [anoStr, mesStr] = (sp.mes ?? "").split("-");
  const ano = Number(anoStr) || hoje.getFullYear();
  const mes = Number(mesStr) || hoje.getMonth() + 1; // 1-12
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 1);
  const diasNoMes = new Date(ano, mes, 0).getDate();

  const mesAnterior = new Date(ano, mes - 2, 1);
  const mesSeguinte = new Date(ano, mes, 1);
  const fmtParam = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const mesLabel = inicioMes.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const monitorandoSolda = ehSetor(setor.nome, "Solda");

  const [apontamentos, funcionarios, opsDoSetor] = await Promise.all([
    prisma.apontamento.findMany({
      where: {
        setorId: setor.id,
        dataHora: { gte: inicioMes, lt: fimMes },
        // Envios do Agrupamento possuem `soldador` preenchido e representam
        // apenas abastecimento. Na grade de Solda entram somente os lançamentos
        // de produção feitos no Monitoramento (`soldador` nulo).
        ...(monitorandoSolda ? { soldador: null } : {}),
      },
      select: {
        opId: true,
        pecaId: true,
        processo: true,
        usuario: true,
        quantidadeBoa: true,
        dataHora: true,
        peca: {
          select: {
            processos: true,
            tipoMaterial: true,
            setor: { select: { nome: true } },
          },
        },
        roteiroEtapa: {
          select: {
            ordem: true,
            setorId: true,
            peca: {
              select: { roteiro: { select: { ordem: true, setorId: true } } },
            },
          },
        },
      },
    }),
    prisma.funcionario.findMany({
      where: { setorId: setor.id, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.oP.findMany({
      where: { status: "ABERTA", modelo: { roteiro: { some: { setorId: setor.id } } } },
      orderBy: { numeroSequencia: "asc" },
      select: {
        id: true,
        numeroSequencia: true,
        lote: true,
        apontamentos: {
          where: { setorId: setor.id, soldador: { not: null } },
          orderBy: { dataHora: "desc" },
          ...(monitorandoSolda ? {} : { take: 1 }),
          select: { soldador: true, quantidadeBoa: true },
        },
        modelo: {
          select: {
            codigo: true,
            pecas: {
              where: { peca: { setorId: setor.id } },
              select: {
                pecaId: true,
                peca: {
                  select: {
                    codigo: true,
                    nome: true,
                    processos: true,
                    tipoMaterial: true,
                    setor: { select: { nome: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  // Somente a ultima etapa interna conta como saida do setor. Os processos
  // anteriores continuam registrados para rastreabilidade, mas nao duplicam
  // os totais de producao.
  const apontamentosSaida = apontamentos.filter((apontamento) => {
    if (apontamento.roteiroEtapa) {
      return !apontamento.roteiroEtapa.peca.roteiro.some(
        (etapa) =>
          etapa.setorId === apontamento.roteiroEtapa?.setorId &&
          etapa.ordem > apontamento.roteiroEtapa.ordem,
      );
    }
    if (!apontamento.pecaId || !apontamento.processo || !apontamento.peca) return true;
    const roteiro = processosDaPeca(apontamento.peca);
    return roteiro.at(-1) === apontamento.processo;
  });

  // Grade dia × operador.
  const operadores = [...new Set([...funcionarios.map((f) => f.nome), ...apontamentosSaida.map((a) => a.usuario)])].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  const grade = new Map<string, number>(); // `${dia}|${usuario}` -> qtd
  for (const a of apontamentosSaida) {
    const chave = `${a.dataHora.getDate()}|${a.usuario}`;
    grade.set(chave, (grade.get(chave) ?? 0) + a.quantidadeBoa);
  }

  const totalPorOperador = new Map<string, number>();
  const diasTrabalhadosPorOperador = new Map<string, number>();
  for (const op of operadores) {
    let total = 0;
    let dias = 0;
    for (let d = 1; d <= diasNoMes; d++) {
      const v = grade.get(`${d}|${op}`) ?? 0;
      total += v;
      if (v > 0) dias++;
    }
    totalPorOperador.set(op, total);
    diasTrabalhadosPorOperador.set(op, dias);
  }

  const producaoMes = apontamentosSaida.reduce((s, a) => s + a.quantidadeBoa, 0);
  const diasComProducao = new Set(apontamentosSaida.map((a) => a.dataHora.getDate())).size;

  // Dias úteis: usa o valor configurado em Configurações; senão conta seg–sex.
  let diasUteisCalc = 0;
  for (let d = 1; d <= diasNoMes; d++) {
    const dow = new Date(ano, mes - 1, d).getDay();
    if (dow !== 0 && dow !== 6) diasUteisCalc++;
  }
  const diasUteis = setor.diasUteisMes ?? diasUteisCalc;

  const meta = setor.metaMensal ?? null;
  const metaIndividual =
    meta && operadores.length > 0 ? Math.ceil(meta / operadores.length) : null;
  const pctMeta = meta ? Math.round((producaoMes / meta) * 100) : null;

  const boundConfig = updateSetorConfig.bind(null, setor.id);

  return (
    <>
      {/* SECTOR SWITCHER */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
        style={{ background: C.card, borderColor: C.border }}
      >
        <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
          Setor
        </span>
        <Link
          href={`/monitoramento?visao=setor&setor=geral&mes=${fmtParam(inicioMes)}`}
          className="rounded border border-[#2d3449] bg-[#060e20] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-all hover:border-slate-500 hover:text-slate-200"
        >
          Produção geral
        </Link>
        {setores.map((s) => {
          const ativo = s.id === setor.id;
          return (
            <Link
              key={s.id}
              href={`/monitoramento?visao=setor&setor=${s.id}&mes=${fmtParam(inicioMes)}`}
              className={`rounded px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
                ativo
                  ? "border border-[#4cd7f6] bg-[#4cd7f6]/10 text-[#4cd7f6] shadow-[0_0_10px_rgba(76,215,246,0.3)]"
                  : "border border-[#2d3449] bg-[#060e20] text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {s.nome}
            </Link>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/monitoramento/relatorio/pdf?setor=${setor.id}&mes=${fmtParam(inicioMes)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-[#f59e0b]/50 bg-[#f59e0b]/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#fbbf24] hover:border-[#fbbf24]"
          >
            Imprimir PDF
          </Link>
          <Link
            href={`/monitoramento?visao=setor&setor=${setor.id}&mes=${fmtParam(mesAnterior)}`}
            className="rounded border border-[#2d3449] bg-[#060e20] px-2.5 py-1.5 font-mono text-xs text-slate-400 hover:text-[#4cd7f6]"
          >
            ‹
          </Link>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#dae2fd]">
            {mesLabel}
          </span>
          <Link
            href={`/monitoramento?visao=setor&setor=${setor.id}&mes=${fmtParam(mesSeguinte)}`}
            className="rounded border border-[#2d3449] bg-[#060e20] px-2.5 py-1.5 font-mono text-xs text-slate-400 hover:text-[#4cd7f6]"
          >
            ›
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi
          label={`Produção ${setor.nome}`}
          value={producaoMes.toLocaleString("pt-BR")}
          tone="cyan"
        />
        <Kpi
          label="Meta do mês"
          value={meta ? meta.toLocaleString("pt-BR") : "—"}
          sub={pctMeta !== null ? `${pctMeta}% atingido` : "defina abaixo"}
          tone={pctMeta !== null && pctMeta >= 100 ? "emerald" : "neutral"}
        />
        <Kpi label="Dias úteis" value={String(diasUteis)} tone="neutral" />
        <Kpi
          label="Dias trabalhados"
          value={String(diasComProducao)}
          tone={diasComProducao === 0 ? "orange" : "neutral"}
        />
        <Kpi label="Líder do setor" value={setor.lider ?? "—"} tone="neutral" texto />
      </div>

      <MonitorApontamentoForm
        setorId={setor.id}
        setorNome={setor.nome}
        operadores={funcionarios}
        ops={opsDoSetor}
      />

      {/* GRADE DIAS × OPERADORES */}
      <div
        className="overflow-hidden rounded-lg border"
        style={{ background: C.card, borderColor: C.border }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: C.border, background: C.cardHigh }}
        >
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#dae2fd]">
            Produção diária · {setor.nome} · {mesLabel}
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            {operadores.length} operador(es)
          </span>
        </div>

        {operadores.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">
            Nenhum funcionário ativo ou apontamento encontrado neste setor em {mesLabel}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr
                  className="border-b text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500"
                  style={{ borderColor: C.border }}
                >
                  <th className="whitespace-nowrap px-4 py-2.5">Data</th>
                  {operadores.map((op) => (
                    <th key={op} className="whitespace-nowrap px-3 py-2.5 text-right">
                      {op}
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-[#4cd7f6]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: diasNoMes }, (_, i) => i + 1).map((dia) => {
                  const data = new Date(ano, mes - 1, dia);
                  const fimDeSemana = data.getDay() === 0 || data.getDay() === 6;
                  const totalDia = operadores.reduce(
                    (s, op) => s + (grade.get(`${dia}|${op}`) ?? 0),
                    0,
                  );
                  return (
                    <tr
                      key={dia}
                      className={`border-b border-white/[0.03] odd:bg-white/[0.02] ${
                        fimDeSemana ? "opacity-40" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-1.5 font-mono text-xs text-slate-400">
                        {String(dia).padStart(2, "0")}/{String(mes).padStart(2, "0")}
                        {fimDeSemana && (
                          <span className="ml-1.5 text-[9px] uppercase">
                            {data.getDay() === 0 ? "dom" : "sáb"}
                          </span>
                        )}
                      </td>
                      {operadores.map((op) => {
                        const v = grade.get(`${dia}|${op}`) ?? 0;
                        return (
                          <td
                            key={op}
                            className={`whitespace-nowrap px-3 py-1.5 text-right font-mono text-xs ${
                              v > 0 ? "font-bold text-[#4cd7f6]" : "text-slate-600"
                            }`}
                          >
                            {v > 0 ? v : "-"}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-4 py-1.5 text-right font-mono text-xs font-bold text-[#dae2fd]">
                        {totalDia > 0 ? totalDia : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="font-mono text-xs">
                <tr
                  className="border-t-2"
                  style={{ borderColor: C.border, background: C.cardHigh }}
                >
                  <td className="px-4 py-2.5 font-bold uppercase tracking-wider text-[#dae2fd]">
                    Total
                  </td>
                  {operadores.map((op) => (
                    <td key={op} className="px-3 py-2.5 text-right font-bold text-[#dae2fd]">
                      {(totalPorOperador.get(op) ?? 0).toLocaleString("pt-BR")}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-bold text-[#4cd7f6]">
                    {producaoMes.toLocaleString("pt-BR")}
                  </td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-4 py-2 uppercase tracking-wider text-slate-500">
                    Média / dia trab.
                  </td>
                  {operadores.map((op) => {
                    const dias = diasTrabalhadosPorOperador.get(op) ?? 0;
                    const media =
                      dias > 0 ? Math.round((totalPorOperador.get(op) ?? 0) / dias) : 0;
                    return (
                      <td key={op} className="px-3 py-2 text-right text-slate-300">
                        {media || "-"}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right text-slate-300">
                    {diasComProducao > 0 ? Math.round(producaoMes / diasComProducao) : "-"}
                  </td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-4 py-2 uppercase tracking-wider text-slate-500">
                    Falta p/ meta indiv.
                  </td>
                  {operadores.map((op) => {
                    if (!metaIndividual)
                      return (
                        <td key={op} className="px-3 py-2 text-right text-slate-600">
                          —
                        </td>
                      );
                    const falta = Math.max(
                      metaIndividual - (totalPorOperador.get(op) ?? 0),
                      0,
                    );
                    return (
                      <td key={op} className="px-3 py-2 text-right">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 font-bold ${
                            falta === 0
                              ? "bg-[#4edea3]/15 text-[#4edea3]"
                              : "bg-[#ec6a06]/15 text-[#ffb690]"
                          }`}
                        >
                          {falta === 0 ? "OK" : falta}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right text-slate-500">
                    {metaIndividual ? `${metaIndividual}/op` : "—"}
                  </td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-4 py-2 uppercase tracking-wider text-slate-500">
                    % meta individual
                  </td>
                  {operadores.map((op) => {
                    if (!metaIndividual)
                      return (
                        <td key={op} className="px-3 py-2 text-right text-slate-600">
                          —
                        </td>
                      );
                    const pct = Math.round(
                      ((totalPorOperador.get(op) ?? 0) / metaIndividual) * 100,
                    );
                    return (
                      <td key={op} className="px-3 py-2 text-right">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 font-bold ${
                            pct >= 100
                              ? "bg-[#4edea3]/15 text-[#4edea3]"
                              : pct >= 60
                                ? "bg-[#4cd7f6]/15 text-[#4cd7f6]"
                                : "bg-[#ec6a06]/15 text-[#ffb690]"
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right text-slate-500">
                    {pctMeta !== null ? `${pctMeta}%` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* CONFIG DO SETOR (meta + líder) */}
      <details
        className="rounded-lg border"
        style={{ background: C.card, borderColor: C.border }}
      >
        <summary className="cursor-pointer px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 hover:text-[#4cd7f6]">
          ⚙ Configurar meta e líder — {setor.nome}
        </summary>
        <form
          action={boundConfig}
          className="flex flex-wrap items-end gap-3 border-t px-5 py-4"
          style={{ borderColor: C.border }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Meta do mês (pçs)
            </label>
            <input
              name="metaMensal"
              type="number"
              min={0}
              defaultValue={setor.metaMensal ?? ""}
              placeholder="Ex.: 18500"
              className={`w-36 ${INPUT_CLS}`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Líder do setor
            </label>
            <input
              name="lider"
              defaultValue={setor.lider ?? ""}
              placeholder="Ex.: Orlando"
              className={`w-44 ${INPUT_CLS}`}
            />
          </div>
          <SubmitButton>Salvar</SubmitButton>
        </form>
      </details>
    </>
  );
}

async function CockpitGeralSetores({
  sp,
  setores,
}: {
  sp: Record<string, string | undefined>;
  setores: Awaited<ReturnType<typeof prisma.setor.findMany>>;
}) {
  const hoje = new Date();
  const [anoStr, mesStr] = (sp.mes ?? "").split("-");
  const ano = Number(anoStr) || hoje.getFullYear();
  const mes = Number(mesStr) || hoje.getMonth() + 1;
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 1);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const mesAnterior = new Date(ano, mes - 2, 1);
  const mesSeguinte = new Date(ano, mes, 1);
  const fmtParam = (data: Date) =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
  const mesLabel = inicioMes.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const apontamentos = await prisma.apontamento.findMany({
    where: { dataHora: { gte: inicioMes, lt: fimMes } },
    select: {
      setorId: true,
      quantidadeBoa: true,
      dataHora: true,
      soldador: true,
      pecaId: true,
      processo: true,
      peca: {
        select: {
          processos: true,
          tipoMaterial: true,
          setor: { select: { nome: true } },
        },
      },
      roteiroEtapa: {
        select: {
          ordem: true,
          setorId: true,
          peca: {
            select: { roteiro: { select: { ordem: true, setorId: true } } },
          },
        },
      },
    },
  });

  const finalizados = apontamentos.filter((apontamento) => {
    // Registros com soldador preenchido representam abastecimento da Solda,
    // não produção efetivamente concluída.
    if (apontamento.soldador) return false;
    if (apontamento.roteiroEtapa) {
      return !apontamento.roteiroEtapa.peca.roteiro.some(
        (etapa) =>
          etapa.setorId === apontamento.roteiroEtapa?.setorId &&
          etapa.ordem > apontamento.roteiroEtapa.ordem,
      );
    }
    if (!apontamento.pecaId || !apontamento.processo || !apontamento.peca) return true;
    const roteiro = processosDaPeca(apontamento.peca);
    return roteiro.at(-1) === apontamento.processo;
  });

  const grade = new Map<string, number>();
  const totalPorSetor = new Map<number, number>();
  for (const apontamento of finalizados) {
    const dia = apontamento.dataHora.getDate();
    const chave = `${apontamento.setorId}|${dia}`;
    grade.set(chave, (grade.get(chave) ?? 0) + apontamento.quantidadeBoa);
    totalPorSetor.set(
      apontamento.setorId,
      (totalPorSetor.get(apontamento.setorId) ?? 0) + apontamento.quantidadeBoa,
    );
  }

  const totalGeral = finalizados.reduce((soma, item) => soma + item.quantidadeBoa, 0);
  const diasComProducao = new Set(finalizados.map((item) => item.dataHora.getDate())).size;
  const setoresComProducao = setores.filter((setor) => (totalPorSetor.get(setor.id) ?? 0) > 0).length;
  let diasUteisPadrao = 0;
  for (let dia = 1; dia <= diasNoMes; dia += 1) {
    const diaSemana = new Date(ano, mes - 1, dia).getDay();
    if (diaSemana !== 0 && diaSemana !== 6) diasUteisPadrao += 1;
  }
  const diasConfigurados = setores
    .map((setor) => setor.diasUteisMes)
    .filter((valor): valor is number => valor !== null && valor > 0);
  const mesmaConfiguracao = diasConfigurados.length > 0 && diasConfigurados.every(
    (valor) => valor === diasConfigurados[0],
  );
  const diasUteis = mesmaConfiguracao ? diasConfigurados[0] : diasUteisPadrao;
  const metaGeral = setores.reduce((total, setor) => total + (setor.metaMensal ?? 0), 0);
  const mediaParaMeta = metaGeral > 0 && diasUteis > 0 ? metaGeral / diasUteis : null;
  const mediaLancamentosDia = diasComProducao > 0 ? totalGeral / diasComProducao : 0;
  const mediaPorLancamento = finalizados.length > 0 ? totalGeral / finalizados.length : 0;

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
        style={{ background: C.card, borderColor: C.border }}
      >
        <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
          Setor
        </span>
        <Link
          href={`/monitoramento?visao=setor&setor=geral&mes=${fmtParam(inicioMes)}`}
          className="rounded border border-[#4cd7f6] bg-[#4cd7f6]/10 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#4cd7f6] shadow-[0_0_10px_rgba(76,215,246,0.3)]"
        >
          Produção geral
        </Link>
        {setores.map((setor) => (
          <Link
            key={setor.id}
            href={`/monitoramento?visao=setor&setor=${setor.id}&mes=${fmtParam(inicioMes)}`}
            className="rounded border border-[#2d3449] bg-[#060e20] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-all hover:border-slate-500 hover:text-slate-200"
          >
            {setor.nome}
          </Link>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/monitoramento/relatorio/pdf?setor=geral&mes=${fmtParam(inicioMes)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-[#f59e0b]/50 bg-[#f59e0b]/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#fbbf24] hover:border-[#fbbf24]"
          >
            Imprimir PDF geral
          </Link>
          <Link
            href={`/monitoramento?visao=setor&setor=geral&mes=${fmtParam(mesAnterior)}`}
            className="rounded border border-[#2d3449] bg-[#060e20] px-2.5 py-1.5 font-mono text-xs text-slate-400 hover:text-[#4cd7f6]"
          >
            ‹
          </Link>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#dae2fd]">
            {mesLabel}
          </span>
          <Link
            href={`/monitoramento?visao=setor&setor=geral&mes=${fmtParam(mesSeguinte)}`}
            className="rounded border border-[#2d3449] bg-[#060e20] px-2.5 py-1.5 font-mono text-xs text-slate-400 hover:text-[#4cd7f6]"
          >
            ›
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Total produzido" value={totalGeral.toLocaleString("pt-BR")} tone="cyan" />
        <Kpi
          label="Meta geral"
          value={metaGeral > 0 ? metaGeral.toLocaleString("pt-BR") : "—"}
          sub="soma das metas dos setores"
          tone="neutral"
        />
        <Kpi
          label="Média p/ meta por dia"
          value={mediaParaMeta === null ? "—" : mediaParaMeta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          sub={`${diasUteis} dias úteis considerados`}
          tone="orange"
        />
        <Kpi
          label="Média dos lançamentos/dia"
          value={mediaLancamentosDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          sub="nos dias com produção"
          tone="neutral"
        />
        <Kpi
          label="Média por lançamento"
          value={mediaPorLancamento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          tone="neutral"
        />
        <Kpi label="Lançamentos" value={String(finalizados.length)} tone="neutral" />
        <Kpi label="Setores com produção" value={`${setoresComProducao}/${setores.length}`} tone="neutral" />
        <Kpi label="Dias com produção" value={String(diasComProducao)} tone="neutral" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {setores.map((setor) => {
          const total = totalPorSetor.get(setor.id) ?? 0;
          const percentual = setor.metaMensal
            ? Math.round((total / setor.metaMensal) * 100)
            : null;
          return (
            <Link
              key={setor.id}
              href={`/monitoramento?visao=setor&setor=${setor.id}&mes=${fmtParam(inicioMes)}`}
              className="rounded-lg border border-[#2d3449] bg-[#131b2e] p-4 transition hover:border-[#4cd7f6]/60 hover:bg-[#171f33]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {setor.nome}
                </span>
                <span className="text-xs text-slate-600">→</span>
              </div>
              <div className="mt-2 font-mono text-3xl font-bold text-[#4cd7f6]">
                {total.toLocaleString("pt-BR")}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#060e20]">
                <div
                  className="h-full rounded-full bg-[#4cd7f6]"
                  style={{ width: `${Math.min(percentual ?? 0, 100)}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                {percentual === null ? "Meta não definida" : `${percentual}% da meta · somente finalizados`}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#2d3449] bg-[#131b2e]">
        <div className="border-b border-[#2d3449] bg-[#171f33] px-5 py-3">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#dae2fd]">
            Produção geral diária · somente saída final · {mesLabel}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-[#2d3449] font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 text-left">Data</th>
                {setores.map((setor) => (
                  <th key={setor.id} className="px-3 py-3 text-right">
                    <Link href={`/monitoramento?visao=setor&setor=${setor.id}&mes=${fmtParam(inicioMes)}`} className="hover:text-[#4cd7f6]">
                      {setor.nome}
                    </Link>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[#4cd7f6]">Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: diasNoMes }, (_, indice) => indice + 1).map((dia) => {
                const totalDia = setores.reduce(
                  (soma, setor) => soma + (grade.get(`${setor.id}|${dia}`) ?? 0),
                  0,
                );
                return (
                  <tr key={dia} className="border-b border-white/[0.04] odd:bg-white/[0.015]">
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">
                      {String(dia).padStart(2, "0")}/{String(mes).padStart(2, "0")}
                    </td>
                    {setores.map((setor) => {
                      const valor = grade.get(`${setor.id}|${dia}`) ?? 0;
                      return (
                        <td key={setor.id} className={`px-3 py-2 text-right font-mono text-xs ${valor > 0 ? "font-bold text-[#4cd7f6]" : "text-slate-700"}`}>
                          {valor || "-"}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right font-mono text-xs font-bold text-white">
                      {totalDia || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#2d3449] bg-[#171f33] font-mono text-xs font-bold">
                <td className="px-4 py-3 uppercase text-white">Total</td>
                {setores.map((setor) => (
                  <td key={setor.id} className="px-3 py-3 text-right text-white">
                    {(totalPorSetor.get(setor.id) ?? 0).toLocaleString("pt-BR")}
                  </td>
                ))}
                <td className="px-4 py-3 text-right text-[#4cd7f6]">
                  {totalGeral.toLocaleString("pt-BR")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  texto = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "cyan" | "emerald" | "orange" | "neutral";
  texto?: boolean;
}) {
  const tones = {
    cyan: "text-[#4cd7f6] [text-shadow:0_0_12px_rgba(76,215,246,0.4)]",
    emerald: "text-[#4edea3]",
    orange: "text-[#ffb690]",
    neutral: "text-[#dae2fd]",
  };
  return (
    <div
      className="flex flex-col rounded-lg border px-5 py-4"
      style={{ background: C.card, borderColor: C.border }}
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </span>
      <span
        className={`mt-1.5 font-mono ${texto ? "text-lg" : "text-3xl"} font-medium ${tones[tone]}`}
      >
        {value}
      </span>
      {sub && (
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          {sub}
        </span>
      )}
    </div>
  );
}

/* ============================================================
   VISÃO 2 — OPs, componentes e processos internos
   ============================================================ */

async function RastreamentoOPs({
  sp,
  setores,
}: {
  sp: Record<string, string | undefined>;
  setores: Awaited<ReturnType<typeof prisma.setor.findMany>>;
}) {
  const busca = (sp.busca ?? "").trim().toLowerCase();
  const setorId = sp.setor ? Number(sp.setor) : null;
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

  const rastreamentoTotal = calcularRastreamento(ops);
  const rastreamento = rastreamentoTotal.filter((item) => {
    const alvo = `${item.op.numeroSequencia} ${item.op.lote ?? ""} ${item.op.modelo.codigo} ${item.op.modelo.nome ?? ""}`.toLowerCase();
    if (busca && !alvo.includes(busca)) return false;
    if (setorId && !item.setores.some((setor) => setor.setorId === setorId)) return false;
    return true;
  });
  const setoresProdutivos = setores.filter(
    (setor) => !["AGRUPAMENTO", "SOLDA", "PINTURA", "MONTAGEM"].includes(setor.nome.toUpperCase()),
  );
  const totalKits = rastreamentoTotal.reduce((soma, item) => soma + item.kitsCompletos, 0);
  const totalPlanejado = rastreamentoTotal.reduce((soma, item) => soma + item.op.quantidade, 0);
  const faltas = rastreamentoTotal.reduce(
    (soma, item) => soma + item.pecas.reduce((sub, peca) => sub + peca.falta, 0),
    0,
  );
  const medias = rastreamentoTotal.length
    ? Math.round(rastreamentoTotal.reduce((soma, item) => soma + item.progressoIndustrial, 0) / rastreamentoTotal.length)
    : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="OPs em fabricação" value={String(rastreamentoTotal.length)} tone="cyan" />
        <Kpi label="Progresso médio" value={`${medias}%`} tone="neutral" />
        <Kpi label="Kits liberáveis" value={`${totalKits}/${totalPlanejado}`} tone="emerald" />
        <Kpi label="Peças pendentes" value={faltas.toLocaleString("pt-BR")} tone={faltas > 0 ? "orange" : "neutral"} />
      </div>

      <div className="rounded-xl border border-white/10 bg-[#111a2c]">
        <form className="flex flex-wrap items-end gap-3 p-4" method="get">
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Buscar OP ou código do engate
            </label>
            <input name="busca" defaultValue={sp.busca ?? ""} placeholder="Ex.: OP 20 ou DEMO-B-200" className={INPUT_CLS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Setor de fabricação
            </label>
            <select name="setor" defaultValue={sp.setor ?? ""} className={INPUT_CLS}>
              <option value="">Todos os setores</option>
              {setoresProdutivos.map((setor) => (
                <option key={setor.id} value={setor.id}>{setor.nome}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded bg-cyan-400 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#04202a] hover:bg-cyan-300">
            Filtrar
          </button>
          <Link href="/monitoramento" className="px-2 py-2 text-xs text-slate-500 hover:text-slate-300">Limpar</Link>
        </form>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
            Ordens em fabricação
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Expanda uma OP para acompanhar cada peça dentro do setor responsável.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/monitoramento/prioridades" className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-400/20">
            Prioridades de pré-pronto →
          </Link>
          <Link href="/monitoramento/fluxo" className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/20">
            Analisar fluxo da fábrica →
          </Link>
        </div>
      </div>

      <OPTrackingBoard itens={rastreamento} />
    </>
  );
}

/* ============================================================
   VISÃO LEGADA — PRODUÇÃO GERAL (mantida para compatibilidade)
   ============================================================ */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function ProducaoGeral({
  sp,
  setores,
}: {
  sp: Record<string, string | undefined>;
  setores: Awaited<ReturnType<typeof prisma.setor.findMany>>;
}) {
  const busca = (sp.busca ?? "").trim().toLowerCase();
  const curva = sp.curva ?? "";
  const etapaPendenteId = sp.etapa ? Number(sp.etapa) : null;
  const dataInicio = sp.inicio ? new Date(sp.inicio) : null;
  const dataFim = sp.fim ? new Date(`${sp.fim}T23:59:59`) : null;

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
  });

  const progressoTotal = calcularProgressoOPs(ops).sort(
    (a, b) => a.op.numeroSequencia - b.op.numeroSequencia,
  );

  const etapa = (p: OPProgresso, nome: string) =>
    p.setores.find((s) => ehSetor(s.setorNome, nome));
  const totalAbertas = progressoTotal.length;
  const aguardandoKit = progressoTotal.filter((p) => !p.prontoParaSolda).length;
  const prontasParaSolda = progressoTotal.filter(
    (p) => p.prontoParaSolda && !(etapa(p, "Solda")?.quantidadeBoa ?? 0),
  ).length;
  const emLinhaFinal = progressoTotal.filter((p) => {
    const solda = etapa(p, "Solda");
    const montagem = etapa(p, "Montagem");
    return (solda?.quantidadeBoa ?? 0) > 0 && !(montagem?.completo ?? false);
  }).length;
  const finalizadas = progressoTotal.filter(
    (p) => etapa(p, "Montagem")?.completo ?? false,
  ).length;
  const foraDeSequencia = progressoTotal.filter((p) => p.foraDeSequencia).length;

  const progresso = progressoTotal.filter((p) => {
    if (busca) {
      const alvo =
        `${p.op.numeroSequencia} ${p.op.lote ?? ""} ${p.op.modelo.codigo} ${p.op.modelo.nome ?? ""}`.toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    if (curva && p.op.modelo.curva !== curva) return false;
    if (etapaPendenteId && p.setorAtual?.setorId !== etapaPendenteId) return false;
    if (dataInicio && p.op.dataLiberacao < dataInicio) return false;
    if (dataFim && p.op.dataLiberacao > dataFim) return false;
    return true;
  });

  const colunas = colunasRoteiro(progresso);

  const setoresLinhaFinal = setores.filter((s) =>
    ["Solda", "Pintura", "Montagem"].some((nome) => ehSetor(s.nome, nome)),
  );
  const opsParaLinhaFinal = progressoTotal.filter((p) =>
    p.setores.some(
      (s) => ["Solda", "Pintura", "Montagem"].some((nome) => ehSetor(s.setorNome, nome)) && !s.completo,
    ),
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="OPs abertas" value={String(totalAbertas)} tone="neutral" />
        <Kpi
          label="Aguardando kit"
          value={String(aguardandoKit)}
          tone={aguardandoKit > 0 ? "orange" : "neutral"}
        />
        <Kpi
          label="Prontas p/ Solda"
          value={String(prontasParaSolda)}
          tone={prontasParaSolda > 0 ? "emerald" : "neutral"}
        />
        <Kpi label="Em linha final" value={String(emLinhaFinal)} tone="cyan" />
        <Kpi
          label="Finalizadas"
          value={String(finalizadas)}
          tone={finalizadas > 0 ? "emerald" : "neutral"}
        />
        <Kpi
          label="Fora de sequência"
          value={String(foraDeSequencia)}
          tone={foraDeSequencia > 0 ? "orange" : "neutral"}
        />
      </div>

      <div
        className="rounded-lg border"
        style={{ background: C.card, borderColor: C.border }}
      >
        <form className="flex flex-wrap items-end gap-3 px-5 py-4" method="get">
          <input type="hidden" name="visao" value="geral" />
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Buscar (OP, modelo ou nome)
            </label>
            <input
              name="busca"
              defaultValue={sp.busca ?? ""}
              placeholder="Ex.: TO1007 ou S10"
              className={`w-52 ${INPUT_CLS}`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Curva
            </label>
            <select name="curva" defaultValue={sp.curva ?? ""} className={INPUT_CLS}>
              <option value="">Todas</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Etapa pendente
            </label>
            <select name="etapa" defaultValue={sp.etapa ?? ""} className={INPUT_CLS}>
              <option value="">Todas</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Liberada de
            </label>
            <input
              type="date"
              name="inicio"
              defaultValue={sp.inicio ?? ""}
              className={INPUT_CLS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              até
            </label>
            <input
              type="date"
              name="fim"
              defaultValue={sp.fim ?? ""}
              className={INPUT_CLS}
            />
          </div>
          <button
            type="submit"
            className="rounded bg-[#06b6d4] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#00303a] hover:bg-[#4cd7f6] transition-colors"
          >
            Filtrar
          </button>
          <Link
            href="/monitoramento?visao=geral"
            className="text-sm font-medium text-slate-500 hover:text-slate-300"
          >
            Limpar
          </Link>
        </form>
      </div>

      <div
        className="overflow-hidden rounded-lg border"
        style={{ background: C.card, borderColor: C.border }}
      >
        <div
          className="border-b px-5 py-3"
          style={{ borderColor: C.border, background: C.cardHigh }}
        >
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#dae2fd]">
            Produção Geral ({progresso.length} OPs)
          </h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Verde = concluída (data) · Âmbar = parcial · — = não iniciada · n/a =
            fora do roteiro
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr
                className="border-b text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500"
                style={{ borderColor: C.border }}
              >
                <th className="whitespace-nowrap px-4 py-3">Seq.</th>
                <th className="whitespace-nowrap px-4 py-3">Lote</th>
                <th className="whitespace-nowrap px-4 py-3">Modelo</th>
                <th className="whitespace-nowrap px-4 py-3">Qtde</th>
                <th className="whitespace-nowrap px-4 py-3">Curva</th>
                <th className="whitespace-nowrap px-4 py-3">Liberada</th>
                {colunas.map((c) => (
                  <th key={c.setorId} className="whitespace-nowrap px-3 py-3 text-center">
                    {c.setorNome}
                  </th>
                ))}
                <th className="whitespace-nowrap px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {progresso.map((p) => (
                <ProducaoGeralRow key={p.op.id} p={p} colunas={colunas} />
              ))}
              {progresso.length === 0 && (
                <tr>
                  <td
                    colSpan={colunas.length + 6}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    Nenhuma OP encontrada com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="rounded-lg border"
        style={{ background: C.card, borderColor: C.border }}
      >
        <div
          className="border-b px-5 py-3"
          style={{ borderColor: C.border, background: C.cardHigh }}
        >
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#dae2fd]">
            Apontamento de linha final
          </h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Registre a produção realizada por OP e responsável, inclusive na Solda.
          </p>
        </div>
        <form
          action={createApontamento}
          className="flex flex-wrap items-end gap-3 px-5 py-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              OP
            </label>
            <select name="opId" required defaultValue="" className={`w-56 ${INPUT_CLS}`}>
              <option value="" disabled>
                Selecione...
              </option>
              {opsParaLinhaFinal.map((p) => (
                <option key={p.op.id} value={p.op.id}>
                  OP {p.op.numeroSequencia} · {p.op.modelo.codigo}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Etapa
            </label>
            <select name="setorId" required defaultValue="" className={INPUT_CLS}>
              <option value="" disabled>
                Selecione...
              </option>
              {setoresLinhaFinal.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Soldador / responsável
            </label>
            <input
              name="usuario"
              required
              placeholder="Mesmo nome usado no abastecimento"
              className={`w-40 ${INPUT_CLS}`}
            />
          </div>
          <div className="flex w-28 flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Quantidade
            </label>
            <input
              name="quantidadeBoa"
              type="number"
              min={1}
              required
              className={INPUT_CLS}
            />
          </div>
          <SubmitButton>Lançar</SubmitButton>
        </form>
        {opsParaLinhaFinal.length === 0 && (
          <p className="px-5 pb-4 font-mono text-[11px] uppercase tracking-wider text-[#ffb690]">
            Nenhuma OP com Solda, Pintura ou Montagem pendente no momento.
          </p>
        )}
      </div>
    </>
  );
}

function ProducaoGeralRow({
  p,
  colunas,
}: {
  p: OPProgresso;
  colunas: { setorId: number; setorNome: string; ordemPadrao: number }[];
}) {
  const montagem = p.setores.find((s) => ehSetor(s.setorNome, "Montagem"));
  const solda = p.setores.find((s) => ehSetor(s.setorNome, "Solda"));
  const finalizada = montagem?.completo ?? false;

  const rowTint = finalizada
    ? "bg-[#4edea3]/5"
    : p.foraDeSequencia
      ? "bg-red-500/5"
      : "";

  return (
    <tr
      className={`border-b border-white/[0.03] odd:bg-white/[0.02] transition-colors hover:bg-white/5 ${rowTint}`}
    >
      <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-[#dae2fd]">
        {p.op.numeroSequencia}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-300">
        {p.op.lote || <span className="text-slate-500">Sem lote</span>}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span className="font-mono text-slate-200">{p.op.modelo.codigo}</span>
        {p.op.modelo.nome && (
          <span className="ml-2 text-xs text-slate-500">{p.op.modelo.nome}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-400">
        {p.op.quantidade}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Badge
          variant={CURVA_VARIANT[p.op.modelo.curva as "A" | "B" | "C"] ?? "neutral"}
        >
          {p.op.modelo.curva}
        </Badge>
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
        {formatDate(p.op.dataLiberacao)}
      </td>
      {colunas.map((c) => {
        const s = p.setores.find((x) => x.setorId === c.setorId);
        if (!s) {
          return (
            <td key={c.setorId} className="px-3 py-3 text-center font-mono text-xs text-slate-600">
              n/a
            </td>
          );
        }
        if (s.pecas.length > 0) {
          const prontas = s.pecas.filter((x) => x.completo).length;
          return (
            <td key={c.setorId} className="px-3 py-3 text-center">
              <span
                className={`inline-flex items-center justify-center rounded px-2 py-1 font-mono text-[11px] font-bold ${
                  s.completo
                    ? "bg-[#4edea3]/15 text-[#4edea3]"
                    : prontas > 0
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-slate-700/40 text-slate-500"
                }`}
                title={s.pecas
                  .map((x) => `${x.codigo}: ${x.produzida}/${x.necessaria}`)
                  .join(" · ")}
              >
                {prontas}/{s.pecas.length} pçs
              </span>
            </td>
          );
        }
        return (
          <td key={c.setorId} className="px-3 py-3 text-center">
            {s.completo ? (
              <span className="inline-flex items-center justify-center rounded bg-[#4edea3]/15 px-2 py-1 font-mono text-[11px] font-bold text-[#4edea3]">
                {s.concluidoEm ? formatDate(s.concluidoEm) : "OK"}
              </span>
            ) : s.quantidadeBoa > 0 ? (
              <span className="inline-flex items-center justify-center rounded bg-amber-500/15 px-2 py-1 font-mono text-[11px] font-bold text-amber-400">
                {s.quantidadeBoa}/{p.op.quantidade}
              </span>
            ) : (
              <span className="font-mono text-slate-600">—</span>
            )}
          </td>
        );
      })}
      <td className="whitespace-nowrap px-4 py-3">
        {finalizada ? (
          <Badge variant="success">Finalizada</Badge>
        ) : (solda?.quantidadeBoa ?? 0) > 0 ? (
          <Badge variant="info">Em linha final</Badge>
        ) : p.prontoParaSolda ? (
          <Badge variant="success">Pronta p/ Solda</Badge>
        ) : p.foraDeSequencia ? (
          <Badge variant="danger">
            Atrasada · OP {p.ultrapassadaPorSeq} na frente
          </Badge>
        ) : p.totalCount === 0 ? (
          <Badge variant="warning">Sem roteiro</Badge>
        ) : (
          <Badge variant="neutral">Falta {p.setorAtual?.setorNome ?? "—"}</Badge>
        )}
      </td>
    </tr>
  );
}
