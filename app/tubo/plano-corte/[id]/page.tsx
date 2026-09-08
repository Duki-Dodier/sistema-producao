import Link from "next/link";
import { notFound } from "next/navigation";
import { AcoesPlanoTubo } from "@/components/tubo-plano-actions";
import { TuboBarrasPlano, type BarraTuboExibicao } from "@/components/tubo-barras-plano";
import { exigirUsuarioLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";
import { planoTuboInclude } from "@/lib/tubo-plano-corte-dados";

export const dynamic = "force-dynamic";

export default async function PlanoCorteTuboDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuarioLogado();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const plano = await prisma.planoCorteTubo.findUnique({ where: { id }, include: planoTuboInclude });
  if (!plano || !ehSetor(plano.setor.nome, "Tubo")) notFound();
  if (!usuario.administrador && usuario.papel !== "PCP" && usuario.setorId !== plano.setorId) notFound();
  const podeGerenciar = usuario.administrador || usuario.papel === "PCP" || (usuario.papel === "LIDER" && ehSetor(usuario.setorNome, "Tubo"));
  const podeConcluir = podeGerenciar || (usuario.papel === "OPERADOR" && ehSetor(usuario.setorNome, "Tubo"));
  const barras: BarraTuboExibicao[] = plano.barras.map((barra) => ({
    id: barra.id, ordem: barra.ordem, perfilA: barra.perfilA, perfilB: barra.perfilB,
    espessuraMm: barra.espessuraMm, origem: barra.origem,
    sobraOrigemCodigo: barra.sobraOrigemId ? `SOBRA #${barra.sobraOrigemId}` : null,
    comprimentoOrigemMm: barra.comprimentoOrigemMm, sobraPrevistaMm: barra.sobraPrevistaMm,
    aproveitamentoPct: barra.aproveitamentoPct,
    itens: barra.itens.map((item) => ({
      opNumero: item.op.numeroSequencia, lote: item.op.lote ?? "SEM LOTE", modelo: item.op.modelo.codigo,
      pecaCodigo: item.peca.codigo, pecaNome: item.peca.nome, quantidade: item.quantidade,
      comprimentoMm: item.comprimentoUnitarioMm,
    })),
  }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><Link href="/relatorios/plano-corte-tubo" className="font-mono text-xs text-cyan-300 hover:text-cyan-200">← VOLTAR AO OTIMIZADOR DE TUBOS</Link><p className="mt-4 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Sequência oficial de corte</p><h1 className="mt-1 text-2xl font-black text-white">{plano.codigo}</h1><p className="mt-1 text-sm text-slate-400">Emitido por {plano.criadoPor.nome} em {plano.emitidoEm.toLocaleString("pt-BR")} · {plano.maquina ? `${plano.maquina.codigo} · ${plano.maquina.nome}` : "Máquina não definida"}</p></div>
        <div className="flex items-center gap-2"><Status status={plano.status} /><Link href={`/tubo/planos/${plano.id}/pdf`} className="rounded-lg bg-cyan-400 px-4 py-2.5 font-mono text-xs font-black uppercase text-slate-950">Baixar PDF</Link></div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Indicador rotulo="Peças" valor={plano.totalPecas} /><Indicador rotulo="Barras novas" valor={plano.totalBarrasNovas} /><Indicador rotulo="Sobras usadas" valor={plano.totalSobrasUsadas} /><Indicador rotulo="Metros úteis" valor={`${(plano.comprimentoPecasMm / 1000).toFixed(2)} m`} /><Indicador rotulo="Desperdício" valor={`${(plano.desperdicioPrevistoMm / 1000).toFixed(2)} m`} /><Indicador rotulo="Sobra futura" valor={`${(plano.sobraReutilizavelPrevistaMm / 1000).toFixed(2)} m`} /><Indicador rotulo="Aproveitamento" valor={`${plano.aproveitamentoPct.toFixed(1)}%`} destaque /></section>
      <section className="rounded-xl border border-slate-700 bg-[#111c2e] p-4"><div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5"><Dado rotulo="Barra padrão" valor={`${plano.comprimentoBarraMm} mm`} /><Dado rotulo="Perda da serra" valor={`${plano.perdaCorteMm} mm`} /><Dado rotulo="Margem inicial" valor={`${plano.margemInicialMm} mm`} /><Dado rotulo="Margem final" valor={`${plano.margemFinalMm} mm`} /><Dado rotulo="Sobra mínima" valor={`${plano.minimoSobraMm} mm`} /></div></section>
      <TuboBarrasPlano barras={barras} />
      {plano.status === "EMITIDO" && <AcoesPlanoTubo planoId={plano.id} barras={plano.barras.map((barra) => ({ id: barra.id, ordem: barra.ordem, sobraPrevistaMm: barra.sobraPrevistaMm }))} podeGerenciar={podeGerenciar} podeConcluir={podeConcluir} />}
      {plano.status === "CONCLUIDO" && <p className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200">Concluído por {plano.concluidoPor?.nome ?? "usuário"} em {plano.concluidoEm?.toLocaleString("pt-BR")}.</p>}
      {plano.status === "CANCELADO" && <p className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">Cancelado por {plano.canceladoPor?.nome ?? "usuário"} em {plano.canceladoEm?.toLocaleString("pt-BR")}.</p>}
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) { return <div><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{rotulo}</p><strong className="mt-1 block text-white">{valor}</strong></div>; }
function Indicador({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) { return <div className={`rounded-xl border p-4 ${destaque ? "border-emerald-400/30 bg-emerald-400/10" : "border-slate-700 bg-[#111c2e]"}`}><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{rotulo}</p><strong className={`mt-2 block text-xl ${destaque ? "text-emerald-300" : "text-white"}`}>{valor}</strong></div>; }
function Status({ status }: { status: string }) { const cor = status === "CONCLUIDO" ? "border-emerald-400/40 text-emerald-300" : status === "CANCELADO" ? "border-rose-400/40 text-rose-300" : "border-cyan-400/40 text-cyan-300"; return <span className={`rounded-lg border px-3 py-2 font-mono text-xs font-black ${cor}`}>{status}</span>; }
