import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EmitirPlanoTubo } from "@/components/tubo-plano-actions";
import { TuboBarrasPlano } from "@/components/tubo-barras-plano";
import { exigirUsuarioLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { calcularPlanoCorteTubo, nomePerfilTubo, type ParametrosPlanoCorteTubo } from "@/lib/tubo-plano-corte";
import { buscarDemandaPlanoTubo, buscarSetorTubo } from "@/lib/tubo-plano-corte-dados";

export const dynamic = "force-dynamic";

function parametro(valor: string | undefined, padrao: number, minimo = 0) {
  const numero = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(numero) && numero >= minimo ? numero : padrao;
}

export default async function PlanoCorteTuboPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const usuario = await exigirUsuarioLogado();
  const setor = await buscarSetorTubo();
  if (!setor) notFound();
  if (!usuario.administrador && usuario.papel !== "PCP" && usuario.setorId !== setor.id) notFound();
  const podePlanejar = usuario.administrador || usuario.papel === "PCP" || (usuario.papel === "LIDER" && ehSetor(usuario.setorNome, "Tubo"));
  const sp = await searchParams;
  const parametros: ParametrosPlanoCorteTubo = {
    comprimentoBarraMm: 6000,
    perdaCorteMm: parametro(sp.perdaCorteMm, 3),
    margemInicialMm: parametro(sp.margemInicialMm, 10),
    margemFinalMm: parametro(sp.margemFinalMm, 10),
    minimoSobraMm: parametro(sp.minimoSobraMm, 500, 1),
  };
  const maquinaIdNumero = Number(sp.maquinaId);
  const maquinaId = Number.isInteger(maquinaIdNumero) && maquinaIdNumero > 0 ? maquinaIdNumero : null;
  const [dados, maquinas, planos, estoqueSobras] = await Promise.all([
    buscarDemandaPlanoTubo(setor.id),
    prisma.maquina.findMany({ where: { setorId: setor.id, ativo: true }, orderBy: { codigo: "asc" }, select: { id: true, codigo: true, nome: true } }),
    prisma.planoCorteTubo.findMany({ where: { setorId: setor.id }, orderBy: { emitidoEm: "desc" }, take: 25, include: { criadoPor: { select: { nome: true } }, maquina: { select: { codigo: true } } } }),
    prisma.sobraTubo.findMany({ where: { status: "DISPONIVEL" }, orderBy: [{ perfilA: "asc" }, { comprimentoMm: "desc" }], select: { id: true, codigo: true, perfilA: true, perfilB: true, espessuraMm: true, comprimentoMm: true } }),
  ]);
  const calculado = sp.calcular === "1";
  const resultado = calculado ? calcularPlanoCorteTubo(dados.demandas, dados.sobras, parametros) : null;
  const barrasExibicao = resultado?.barras.map((barra) => ({ ...barra })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="PLANO DE CORTE · TUBO" subtitle="Aproveitamento automático das barras de 6 metros para todas as OPs abertas" />
      <nav className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-1">
        <Link href={`/apontamentos?setor=${setor.id}`} className="rounded-lg px-5 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white">Produção</Link>
        <span className="rounded-lg bg-cyan-400/15 px-5 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-cyan-300">Plano de corte</span>
      </nav>

      <section className="rounded-xl border border-cyan-400/20 bg-[#111c2e] p-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p className="font-mono text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">Parâmetros do plano</p><h2 className="mt-1 text-lg font-bold text-white">Calcular aproveitamento</h2></div>
          <span className="rounded-md border border-slate-700 px-3 py-1.5 font-mono text-xs text-slate-400">BARRA PADRÃO · 6.000 MM</span>
        </div>
        <form method="get" className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <input type="hidden" name="calcular" value="1" />
          <label className="text-xs text-slate-400">Máquina
            <select name="maquinaId" defaultValue={maquinaId ?? ""} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"><option value="">Definir depois</option>{maquinas.map((maquina) => <option key={maquina.id} value={maquina.id}>{maquina.codigo} · {maquina.nome}</option>)}</select>
          </label>
          <CampoParametro nome="perdaCorteMm" rotulo="Perda da serra (mm)" valor={parametros.perdaCorteMm} />
          <CampoParametro nome="margemInicialMm" rotulo="Margem inicial (mm)" valor={parametros.margemInicialMm} />
          <CampoParametro nome="margemFinalMm" rotulo="Margem final (mm)" valor={parametros.margemFinalMm} />
          <CampoParametro nome="minimoSobraMm" rotulo="Sobra mínima (mm)" valor={parametros.minimoSobraMm} minimo={1} />
          <button className="rounded-lg bg-cyan-400 px-5 py-3 font-mono text-xs font-black uppercase tracking-wider text-slate-950 md:col-span-2 xl:col-span-5">Calcular aproveitamento de todas as OPs abertas</button>
        </form>
      </section>

      {dados.incompletas.length > 0 && (
        <section className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5">
          <h2 className="font-bold text-amber-200">Peças bloqueadas por cadastro incompleto</h2>
          <p className="mt-1 text-sm text-amber-100/70">O cálculo não será emitido até as medidas abaixo serem preenchidas.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">{dados.incompletas.map((peca) => <Link key={peca.id} href={`/registros/pecas/${peca.id}`} className="rounded-lg border border-amber-300/20 bg-slate-950/30 p-3 text-sm text-amber-100 hover:border-amber-300/50"><strong>{peca.codigo}</strong> · {peca.nome}<span className="mt-1 block text-xs text-amber-200/60">Falta: {peca.campos.join(", ")}</span></Link>)}</div>
        </section>
      )}

      {resultado && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Indicador rotulo="OPs atendidas" valor={resultado.indicadores.opsAtendidas} />
            <Indicador rotulo="Peças" valor={resultado.indicadores.pecasProgramadas} />
            <Indicador rotulo="Barras novas" valor={resultado.indicadores.barrasNovas} />
            <Indicador rotulo="Sobras usadas" valor={resultado.indicadores.sobrasReaproveitadas} />
            <Indicador rotulo="Metros úteis" valor={`${resultado.indicadores.metrosUtilizados.toFixed(2)} m`} />
            <Indicador rotulo="Desperdício" valor={`${(resultado.indicadores.desperdicioMm / 1000).toFixed(2)} m`} alerta />
            <Indicador rotulo="Aproveitamento" valor={`${resultado.indicadores.aproveitamentoPct.toFixed(1)}%`} destaque />
          </section>
          {resultado.erros.length > 0 && <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{resultado.erros.join(" ")}</div>}
          {barrasExibicao.length > 0 ? <TuboBarrasPlano barras={barrasExibicao} /> : <div className="rounded-xl border border-slate-700 p-8 text-center text-slate-400">Nenhuma peça pendente para programar.</div>}
          {podePlanejar && barrasExibicao.length > 0 && <EmitirPlanoTubo parametros={parametros} maquinaId={maquinaId} desabilitado={dados.incompletas.length > 0 || resultado.erros.length > 0} />}
        </>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#111c2e]">
          <div className="border-b border-slate-700 px-5 py-4"><h2 className="font-bold text-white">Histórico de planos</h2><p className="mt-1 text-xs text-slate-500">Últimos 25 registros emitidos</p></div>
          <div className="divide-y divide-slate-800">{planos.length ? planos.map((plano) => <Link key={plano.id} href={`/tubo/plano-corte/${plano.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-800/50"><div><strong className="font-mono text-cyan-300">{plano.codigo}</strong><p className="mt-1 text-xs text-slate-500">{plano.criadoPor.nome} · {plano.maquina?.codigo ?? "Máquina não definida"} · {plano.emitidoEm.toLocaleString("pt-BR")}</p></div><div className="text-right"><Status status={plano.status} /><p className="mt-1 font-mono text-xs text-slate-400">{plano.totalPecas} peças · {plano.aproveitamentoPct.toFixed(1)}%</p></div></Link>) : <p className="p-6 text-sm text-slate-500">Nenhum plano emitido.</p>}</div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#111c2e]">
          <div className="border-b border-slate-700 px-5 py-4"><h2 className="font-bold text-white">Estoque de sobras</h2><p className="mt-1 text-xs text-slate-500">Pontas disponíveis para o próximo cálculo</p></div>
          <div className="max-h-[420px] divide-y divide-slate-800 overflow-y-auto">{estoqueSobras.length ? estoqueSobras.map((sobra) => <div key={sobra.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><div><strong className="font-mono text-emerald-300">{sobra.codigo}</strong><p className="text-xs text-slate-500">{nomePerfilTubo(sobra.perfilA, sobra.perfilB, sobra.espessuraMm)}</p></div><strong className="font-mono text-white">{sobra.comprimentoMm.toFixed(1)} mm</strong></div>) : <p className="p-6 text-sm text-slate-500">Nenhuma sobra disponível.</p>}</div>
        </div>
      </section>
    </div>
  );
}

function CampoParametro({ nome, rotulo, valor, minimo = 0 }: { nome: string; rotulo: string; valor: number; minimo?: number }) {
  return <label className="text-xs text-slate-400">{rotulo}<input name={nome} type="number" min={minimo} step="0.1" defaultValue={valor} required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" /></label>;
}
function Indicador({ rotulo, valor, alerta, destaque }: { rotulo: string; valor: string | number; alerta?: boolean; destaque?: boolean }) {
  return <div className={`rounded-xl border p-4 ${destaque ? "border-emerald-400/30 bg-emerald-400/10" : alerta ? "border-amber-400/25 bg-amber-400/5" : "border-slate-700 bg-[#111c2e]"}`}><p className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500">{rotulo}</p><p className={`mt-2 text-xl font-black ${destaque ? "text-emerald-300" : alerta ? "text-amber-200" : "text-white"}`}>{valor}</p></div>;
}
function Status({ status }: { status: string }) {
  const classe = status === "CONCLUIDO" ? "border-emerald-400/40 text-emerald-300" : status === "CANCELADO" ? "border-rose-400/40 text-rose-300" : "border-cyan-400/40 text-cyan-300";
  return <span className={`rounded border px-2 py-1 font-mono text-[10px] font-black ${classe}`}>{status}</span>;
}
