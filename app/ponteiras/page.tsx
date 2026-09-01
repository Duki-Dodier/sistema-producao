import Link from "next/link";
import { buscarOperadorLogado } from "@/lib/auth-operador";
import { salvarEstoquePonteiras } from "@/lib/actions/ponteiras";
import { prisma } from "@/lib/prisma";
import { normalizarNomeSetor } from "@/lib/setores";
import {
  componentesParaTamanho,
  COMPONENTES_PONTEIRA,
  normalizarTamanhoPonteira,
  TAMANHOS_PONTEIRA,
  type TamanhoPonteira,
} from "@/lib/ponteiras";

type Movimentos = { tuboCortado: number; chapaCortada: number; soldada: number; lixada: number };
type ControlePonteira = Movimentos & { demanda: number; modelos: Set<string>; ops: number };
type OPBase = { id: number; modeloId: number; numeroSequencia: number; lote: string | null; quantidade: number };
type ModeloBase = { id: number; codigo: string; nome: string | null; tamanhoPonteira: string | null; tipo: string };

const INPUT = "w-28 rounded border border-slate-600 bg-[#0b1326] px-2 py-1.5 font-mono text-slate-100 outline-none transition-colors focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60";

function criarControle(): ControlePonteira {
  return { demanda: 0, modelos: new Set<string>(), ops: 0, tuboCortado: 0, chapaCortada: 0, soldada: 0, lixada: 0 };
}

function criarMovimentos(): Movimentos {
  return { tuboCortado: 0, chapaCortada: 0, soldada: 0, lixada: 0 };
}

function chaveMovimento(opId: number, pecaId: number) {
  return `${opId}:${pecaId}`;
}

function obterMovimento(mapa: Map<string, Movimentos>, opId: number, pecaId: number | null) {
  return pecaId === null ? criarMovimentos() : mapa.get(chaveMovimento(opId, pecaId)) ?? criarMovimentos();
}

function adicionarMovimento(mapa: Map<string, Movimentos>, opId: number, pecaId: number, campo: keyof Movimentos, quantidade: number) {
  const chave = chaveMovimento(opId, pecaId);
  const atual = mapa.get(chave) ?? criarMovimentos();
  atual[campo] += quantidade;
  mapa.set(chave, atual);
}

function numero(valor: number) {
  return valor.toLocaleString("pt-BR");
}

function idsEmLotes<T>(ids: T[], tamanho: number) {
  const lotes: T[][] = [];
  for (let indice = 0; indice < ids.length; indice += tamanho) lotes.push(ids.slice(indice, indice + tamanho));
  return lotes;
}

async function carregarOps(modelos: ModeloBase[]) {
  const ids = modelos.map((modelo) => modelo.id);
  if (ids.length === 0) return [] as OPBase[];
  return (await Promise.all(idsEmLotes(ids, 40).map((lote) => prisma.oP.findMany({
    where: { modeloId: { in: lote }, status: "ABERTA" },
    orderBy: { numeroSequencia: "asc" },
    select: { id: true, modeloId: true, numeroSequencia: true, lote: true, quantidade: true },
  })))).flat();
}

export default async function PonteirasPage() {
  const codigosComponentes = Object.values(COMPONENTES_PONTEIRA).map((componente) => componente.codigo);
  const [usuario, estoques, modelosMachoBase, modelosRemoviveisBase, componentes] = await Promise.all([
    buscarOperadorLogado(),
    prisma.estoquePonteira.findMany(),
    prisma.modelo.findMany({ where: { tipo: "PONTEIRA_MACHO" }, orderBy: { codigo: "asc" }, select: { id: true, codigo: true, nome: true, tamanhoPonteira: true, tipo: true } }),
    prisma.modelo.findMany({ where: { tipo: "REMOVIVEL" }, orderBy: { codigo: "asc" }, select: { id: true, codigo: true, nome: true, tamanhoPonteira: true, tipo: true } }),
    prisma.peca.findMany({ where: { codigo: { in: codigosComponentes } }, select: { id: true, codigo: true, nome: true, setor: { select: { nome: true } } } }),
  ]);

  const [opsMacho, opsRemoviveis] = await Promise.all([carregarOps(modelosMachoBase), carregarOps(modelosRemoviveisBase)]);
  const todosOps = [...opsMacho, ...opsRemoviveis];
  const idsComponentes = componentes.map((componente) => componente.id);
  const apontamentos = todosOps.length > 0 && idsComponentes.length > 0
    ? (await Promise.all(idsEmLotes(todosOps.map((op) => op.id), 40).map((lote) => prisma.apontamento.findMany({
        where: { opId: { in: lote }, pecaId: { in: idsComponentes } },
        select: { opId: true, pecaId: true, quantidadeBoa: true, processo: true, setor: { select: { nome: true } } },
      })))).flat()
    : [];

  const movimentos = new Map<string, Movimentos>();
  for (const apontamento of apontamentos) {
    if (apontamento.pecaId === null) continue;
    const processo = normalizarNomeSetor(apontamento.processo ?? "");
    const setor = normalizarNomeSetor(apontamento.setor.nome);
    if (setor === "PLASMA TUBO") adicionarMovimento(movimentos, apontamento.opId, apontamento.pecaId, "tuboCortado", apontamento.quantidadeBoa);
    if (setor === "PLASMA CHAPA") adicionarMovimento(movimentos, apontamento.opId, apontamento.pecaId, "chapaCortada", apontamento.quantidadeBoa);
    if (setor === "PONTEIRA" && processo === "SOLDAGEM") adicionarMovimento(movimentos, apontamento.opId, apontamento.pecaId, "soldada", apontamento.quantidadeBoa);
    if (setor === "PONTEIRA" && processo === "LIXAR") adicionarMovimento(movimentos, apontamento.opId, apontamento.pecaId, "lixada", apontamento.quantidadeBoa);
  }

  const pecaPorCodigo = new Map(componentes.map((peca) => [peca.codigo, peca]));
  const idsComponentePorTamanho = new Map(TAMANHOS_PONTEIRA.map((tamanho) => {
    const padrao = componentesParaTamanho(tamanho.chave);
    return [tamanho.chave, { tuboId: pecaPorCodigo.get(padrao.tubo.codigo)?.id ?? null, chapaId: pecaPorCodigo.get(padrao.chapa.codigo)?.id ?? null }];
  }));
  const modelosMacho = modelosMachoBase.map((modelo) => ({ ...modelo, ops: opsMacho.filter((op) => op.modeloId === modelo.id).sort((a, b) => a.numeroSequencia - b.numeroSequencia) }));
  const modelosRemoviveis = modelosRemoviveisBase.map((modelo) => ({ ...modelo, ops: opsRemoviveis.filter((op) => op.modeloId === modelo.id).sort((a, b) => a.numeroSequencia - b.numeroSequencia) }));

  const controlesMacho = new Map<TamanhoPonteira, ControlePonteira>(TAMANHOS_PONTEIRA.map((tamanho) => [tamanho.chave, criarControle()]));
  const detalhesMacho: Array<{ codigo: string; numeroSequencia: number; lote: string | null; tamanho: TamanhoPonteira; demanda: number; movimentos: Movimentos }> = [];
  const controlesRemoviveis = new Map<TamanhoPonteira, ControlePonteira>(TAMANHOS_PONTEIRA.map((tamanho) => [tamanho.chave, criarControle()]));
  const detalhesRemoviveis: Array<{ codigo: string; numeroSequencia: number; lote: string | null; tamanho: TamanhoPonteira; demanda: number; movimentos: Movimentos }> = [];

  const movimentoDaOP = (op: OPBase, tamanho: TamanhoPonteira, parearComponentes: boolean): Movimentos => {
    const ids = idsComponentePorTamanho.get(tamanho);
    if (!ids) return criarMovimentos();
    const tubo = obterMovimento(movimentos, op.id, ids.tuboId);
    const chapa = obterMovimento(movimentos, op.id, ids.chapaId);
    return { tuboCortado: tubo.tuboCortado, chapaCortada: chapa.chapaCortada, soldada: parearComponentes ? Math.min(tubo.soldada, chapa.soldada) : tubo.soldada + chapa.soldada, lixada: parearComponentes ? Math.min(tubo.lixada, chapa.lixada) : tubo.lixada + chapa.lixada };
  };

  for (const modelo of modelosMacho) {
    const tamanho = normalizarTamanhoPonteira(modelo.tamanhoPonteira);
    if (!tamanho) continue;
    const controle = controlesMacho.get(tamanho)!;
    for (const op of modelo.ops) {
      const movimento = movimentoDaOP(op, tamanho, true);
      controle.demanda += op.quantidade; controle.modelos.add(modelo.codigo); controle.ops += 1;
      controle.tuboCortado += movimento.tuboCortado; controle.chapaCortada += movimento.chapaCortada; controle.soldada += movimento.soldada; controle.lixada += movimento.lixada;
      detalhesMacho.push({ codigo: modelo.codigo, numeroSequencia: op.numeroSequencia, lote: op.lote, tamanho, demanda: op.quantidade, movimentos: movimento });
    }
  }
  for (const modelo of modelosRemoviveis) {
    const tamanho = normalizarTamanhoPonteira(modelo.tamanhoPonteira);
    if (!tamanho) continue;
    const controle = controlesRemoviveis.get(tamanho)!;
    for (const op of modelo.ops) {
      const movimento = movimentoDaOP(op, tamanho, false);
      controle.demanda += op.quantidade; controle.modelos.add(modelo.codigo); controle.ops += 1;
      controle.tuboCortado += movimento.tuboCortado; controle.chapaCortada += movimento.chapaCortada; controle.soldada += movimento.soldada; controle.lixada += movimento.lixada;
      detalhesRemoviveis.push({ codigo: modelo.codigo, numeroSequencia: op.numeroSequencia, lote: op.lote, tamanho, demanda: op.quantidade, movimentos: movimento });
    }
  }

  const estoquePorTamanho = new Map(estoques.map((estoque) => [estoque.tamanho, estoque]));
  const basesCalculo = TAMANHOS_PONTEIRA.map((tamanho) => {
    const controle = controlesMacho.get(tamanho.chave)!;
    const estoque = estoquePorTamanho.get(tamanho.chave) ?? { quantidadePronta: 0, tubosCortados: 0, chapasCortadas: 0 };
    const demandaPendente = Math.max(controle.demanda - controle.lixada - estoque.quantidadePronta, 0);
    const tubosEmPreProntoDaOp = Math.max(controle.tuboCortado - controle.soldada, 0);
    const chapasEmPreProntoDaOp = Math.max(controle.chapaCortada - controle.soldada, 0);
    return { tamanho, controle, estoque, demandaPendente, chapaDisponivel: estoque.chapasCortadas + chapasEmPreProntoDaOp, tubosEmPreProntoDaOp };
  });
  let tubosPMRestantes = (estoquePorTamanho.get("PEQUENA")?.tubosCortados ?? 0) + (basesCalculo.find((base) => base.tamanho.chave === "PEQUENA")?.tubosEmPreProntoDaOp ?? 0) + (basesCalculo.find((base) => base.tamanho.chave === "MEDIA")?.tubosEmPreProntoDaOp ?? 0);
  const calculos = basesCalculo.map((base) => {
    const ehPM = base.tamanho.chave === "PEQUENA" || base.tamanho.chave === "MEDIA";
    const tuboDisponivel = ehPM ? tubosPMRestantes : base.estoque.tubosCortados + base.tubosEmPreProntoDaOp;
    const paresPossiveis = Math.min(base.demandaPendente, base.chapaDisponivel);
    const prePronto = Math.min(paresPossiveis, tuboDisponivel);
    if (ehPM) tubosPMRestantes = Math.max(tubosPMRestantes - prePronto, 0);
    return { ...base, tuboDisponivel, prePronto, filaSolda: Math.min(prePronto, base.demandaPendente), faltaCortar: Math.max(base.demandaPendente - prePronto, 0) };
  });

  const modelosPendentes = modelosRemoviveis.filter((modelo) => modelo.ops.length > 0 && !normalizarTamanhoPonteira(modelo.tamanhoPonteira));
  const podeAtualizarSaldo = Boolean(usuario?.administrador || ["LIDER", "PCP"].includes(usuario?.papel ?? ""));

  return (
    <div className="flex min-h-full w-full flex-col gap-5 bg-[#0b1326] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Produção e estoque</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-[#dae2fd]">Ponteiras Macho</h1><p className="mt-1 max-w-4xl text-xs leading-5 text-slate-400">Controle das ponteiras macho pequena, média e grande. Cada OP usa o tubo e a chapa correspondentes na BOM, registra o corte no Plasma, a soldagem e o acabamento no setor Ponteira e alimenta o estoque de prontas.</p></div><div className="flex flex-wrap gap-2"><Link href="/ops" className="rounded bg-cyan-500 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-950 transition-colors hover:bg-cyan-300">Lançar OP de ponteira macho</Link><Link href="/plasma" className="rounded border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-200 transition-colors hover:bg-cyan-400/20">Acompanhar Plasma</Link></div></div>

      <section className="grid gap-3 md:grid-cols-3">{modelosMacho.map((modelo) => { const tamanho = normalizarTamanhoPonteira(modelo.tamanhoPonteira); const info = tamanho ? TAMANHOS_PONTEIRA.find((item) => item.chave === tamanho) : null; return <div key={modelo.id} className="rounded-lg border border-cyan-400/20 bg-[#131b2e] px-4 py-3"><div className="flex items-center justify-between"><div><p className="font-mono text-sm font-bold text-cyan-200">{modelo.codigo}</p><p className="text-xs text-slate-300">{modelo.nome}</p></div><span className="rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] font-bold uppercase text-cyan-300">{info?.nome ?? "Sem tamanho"}</span></div><p className="mt-2 text-[10px] text-slate-500">BOM: {tamanho ? `${componentesParaTamanho(tamanho).tubo.codigo} + ${componentesParaTamanho(tamanho).chapa.codigo}` : "configurar"} · {modelo.ops.length} OP{modelo.ops.length === 1 ? "" : "s"} aberta{modelo.ops.length === 1 ? "" : "s"}</p></div>; })}</section>

      <section className="grid gap-4 xl:grid-cols-3">{calculos.map(({ tamanho, controle, estoque, demandaPendente, prePronto, filaSolda, faltaCortar, tuboDisponivel }) => <div key={tamanho.chave} className="overflow-hidden rounded-lg border border-[#2d3449] bg-[#131b2e] shadow-lg"><div className="flex items-center justify-between border-b border-[#2d3449] bg-[#171f33] px-4 py-3"><div><h2 className="font-mono text-sm font-bold uppercase tracking-wider text-[#dae2fd]">Ponteira {tamanho.nome}</h2><p className="mt-0.5 text-[11px] text-slate-500">Tubo {componentesParaTamanho(tamanho.chave).tubo.codigo} · Chapa {componentesParaTamanho(tamanho.chave).chapa.codigo} · {tamanho.espessuraChapa}</p></div><span className="rounded bg-cyan-400/10 px-2 py-1 font-mono text-[10px] font-bold text-cyan-300">{numero(controle.ops)} OPs</span></div><dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-xs"><Indicador label="Demanda a produzir" valor={numero(demandaPendente)} cor="text-[#dae2fd]" /><Indicador label="Prontas em estoque" valor={numero(estoque.quantidadePronta)} cor="text-emerald-300" /><Indicador label="Pré-pronto (tubo + chapa)" valor={`${numero(prePronto)} pares`} cor="text-cyan-300" /><Indicador label="Na fila de solda" valor={numero(filaSolda)} cor="text-violet-300" /><div className="col-span-2 rounded border border-amber-400/25 bg-amber-400/10 px-3 py-2"><dt className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Programar no Plasma</dt><dd className="mt-1 font-mono text-sm font-bold text-amber-200">{numero(faltaCortar)} tubos + {numero(faltaCortar)} chapas</dd></div></dl><p className="border-t border-white/5 px-4 py-2 text-[10px] text-slate-500">Modelos: {controle.modelos.size ? [...controle.modelos].join(", ") : "nenhuma OP aberta"}.</p></div>)}</section>

      <section className="overflow-hidden rounded-lg border border-[#2d3449] bg-[#131b2e]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d3449] bg-[#171f33] px-5 py-3"><div><h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#dae2fd]">Estoque físico das ponteiras macho</h2><p className="mt-0.5 text-[11px] text-slate-500">Informe material já separado e ponteiras prontas que não estão vinculados a uma OP. O tubo PON-TB-PM é compartilhado entre pequena e média.</p></div>{!podeAtualizarSaldo && <span className="text-[11px] text-slate-500">Consulta disponível para sua função.</span>}</div><form action={salvarEstoquePonteiras} className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-xs text-slate-300"><thead className="border-b border-white/5 bg-[#0e1728] font-mono text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3 font-semibold">Tipo</th><th className="px-4 py-3 font-semibold">Código da chapa</th><th className="px-4 py-3 font-semibold">Código do tubo</th><th className="px-4 py-3 font-semibold">Prontas em estoque</th><th className="px-4 py-3 font-semibold">Tubos cortados</th><th className="px-4 py-3 font-semibold">Chapas cortadas</th></tr></thead><tbody className="divide-y divide-white/5">{TAMANHOS_PONTEIRA.map((tamanho) => { const saldo = estoquePorTamanho.get(tamanho.chave); const padrao = componentesParaTamanho(tamanho.chave); const nomeCampoTubo = tamanho.chave === "PEQUENA" ? "tubos-PM" : tamanho.chave === "GRANDE" ? "tubos-G" : null; return <tr key={tamanho.chave} className="hover:bg-white/[0.03]"><td className="px-4 py-3 font-semibold text-slate-100">{tamanho.nome}<span className="ml-2 text-[10px] text-slate-500">{tamanho.espessuraChapa}</span></td><td className="px-4 py-3 font-mono text-cyan-200">{padrao.chapa.codigo}</td><td className="px-4 py-3 font-mono text-cyan-200">{padrao.tubo.codigo}{tamanho.chave !== "GRANDE" && <span className="ml-1 text-[10px] text-slate-500">compartilhado P/M</span>}</td><td className="px-4 py-3"><input name={`prontas-${tamanho.chave}`} type="number" min="0" defaultValue={saldo?.quantidadePronta ?? 0} disabled={!podeAtualizarSaldo} className={INPUT} /></td><td className="px-4 py-3">{nomeCampoTubo ? <input name={nomeCampoTubo} type="number" min="0" defaultValue={saldo?.tubosCortados ?? 0} disabled={!podeAtualizarSaldo} className={INPUT} /> : <span className="text-[11px] text-slate-500">Informado na linha Pequena</span>}</td><td className="px-4 py-3"><input name={`chapas-${tamanho.chave}`} type="number" min="0" defaultValue={saldo?.chapasCortadas ?? 0} disabled={!podeAtualizarSaldo} className={INPUT} /></td></tr>; })}</tbody></table>{podeAtualizarSaldo && <div className="flex justify-end border-t border-white/5 px-4 py-3"><button type="submit" className="rounded bg-emerald-600 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-emerald-500">Salvar saldo físico</button></div>}</form></section>

      <section className="overflow-hidden rounded-lg border border-cyan-400/20 bg-[#131b2e]"><div className="border-b border-[#2d3449] bg-[#171f33] px-5 py-3"><h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#dae2fd]">OPs de ponteira macho</h2><p className="mt-0.5 text-[11px] text-slate-500">Acompanhe a quantidade programada, cortes no Plasma, soldagem e acabamento de cada OP.</p></div><TabelaOps detalhes={detalhesMacho} vazio="Nenhuma OP de ponteira macho aberta. Use “Lançar OP de ponteira macho” para programar Pequena, Média ou Grande." /></section>

      {detalhesRemoviveis.length > 0 && <section className="overflow-hidden rounded-lg border border-[#2d3449] bg-[#131b2e]"><div className="border-b border-[#2d3449] bg-[#171f33] px-5 py-3"><h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#dae2fd]">Demanda dos engates removíveis</h2><p className="mt-0.5 text-[11px] text-slate-500">O tubo fêmea “Ponteira Rem.” permanece na BOM do engate. A ponteira macho usada nele é controlada separadamente nesta página.</p></div><TabelaOps detalhes={detalhesRemoviveis} vazio="Nenhuma OP removível aberta com tamanho informado." /></section>}

      {modelosPendentes.length > 0 && <div className="rounded-lg border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><b>{modelosPendentes.length} modelo{modelosPendentes.length === 1 ? "" : "s"} removível{modelosPendentes.length === 1 ? "" : "is"} com OP aberta ainda não possui tamanho de ponteira.</b>{" "}Informe Pequena, Média ou Grande na ficha do modelo para incluir a demanda no controle.</div>}

      <section className="overflow-hidden rounded-lg border border-[#2d3449] bg-[#131b2e]"><div className="border-b border-[#2d3449] bg-[#171f33] px-5 py-3"><h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#dae2fd]">Componentes padronizados</h2><p className="mt-0.5 text-[11px] text-slate-500">Nos modelos Ponteira Macho, estes SKUs entram na BOM. Nos engates removíveis, o tubo fêmea “Ponteira Rem.” continua na BOM e estes componentes são controlados à parte.</p></div><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">{Object.values(COMPONENTES_PONTEIRA).map((componente) => { const peca = pecaPorCodigo.get(componente.codigo); return <div key={componente.codigo} className="rounded border border-white/10 bg-[#0e1728] p-3"><p className="font-mono text-sm font-bold text-cyan-200">{componente.codigo}</p><p className="mt-1 text-xs text-slate-200">{componente.nome}</p><p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">{peca?.setor?.nome ?? componente.setor}</p>{componente.codigo === COMPONENTES_PONTEIRA.chapa12.codigo && <p className="mt-1 text-[10px] text-slate-500">Usada nas ponteiras pequena e média</p>}{componente.codigo === COMPONENTES_PONTEIRA.chapa16.codigo && <p className="mt-1 text-[10px] text-slate-500">Usada na ponteira grande</p>}</div>; })}</div><div className="border-t border-white/5 px-5 py-3 text-[11px] text-slate-500">Pequena → {componentesParaTamanho("PEQUENA").tubo.codigo} + {componentesParaTamanho("PEQUENA").chapa.codigo} · Média → {componentesParaTamanho("MEDIA").tubo.codigo} + {componentesParaTamanho("MEDIA").chapa.codigo} · Grande → {componentesParaTamanho("GRANDE").tubo.codigo} + {componentesParaTamanho("GRANDE").chapa.codigo}</div></section>
    </div>
  );
}

function TabelaOps({ detalhes, vazio }: { detalhes: Array<{ codigo: string; numeroSequencia: number; lote: string | null; tamanho: TamanhoPonteira; demanda: number; movimentos: Movimentos }>; vazio: string }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-xs text-slate-300"><thead className="border-b border-white/5 bg-[#0e1728] font-mono text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3 font-semibold">OP</th><th className="px-4 py-3 font-semibold">Modelo</th><th className="px-4 py-3 font-semibold">Ponteira</th><th className="px-4 py-3 text-right font-semibold">Programada</th><th className="px-4 py-3 text-right font-semibold">Tubo cortado</th><th className="px-4 py-3 text-right font-semibold">Chapa cortada</th><th className="px-4 py-3 text-right font-semibold">Soldada</th><th className="px-4 py-3 text-right font-semibold">Acabada</th></tr></thead><tbody className="divide-y divide-white/5">{detalhes.map((op) => <tr key={`${op.numeroSequencia}-${op.codigo}`} className="hover:bg-white/[0.03]"><td className="px-4 py-3 font-mono font-bold text-slate-100">{op.numeroSequencia}<span className="ml-2 text-slate-500">{op.lote ?? ""}</span></td><td className="px-4 py-3 font-mono text-cyan-200">{op.codigo}</td><td className="px-4 py-3">{TAMANHOS_PONTEIRA.find((tamanho) => tamanho.chave === op.tamanho)?.nome}</td><td className="px-4 py-3 text-right font-mono">{numero(op.demanda)}</td><td className="px-4 py-3 text-right font-mono text-cyan-200">{numero(op.movimentos.tuboCortado)}</td><td className="px-4 py-3 text-right font-mono text-cyan-200">{numero(op.movimentos.chapaCortada)}</td><td className="px-4 py-3 text-right font-mono text-violet-300">{numero(op.movimentos.soldada)}</td><td className="px-4 py-3 text-right font-mono text-emerald-300">{numero(op.movimentos.lixada)}</td></tr>)}{detalhes.length === 0 && <tr><td colSpan={8} className="px-5 py-9 text-center text-slate-500">{vazio}</td></tr>}</tbody></table></div>;
}

function Indicador({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return <div><dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</dt><dd className={`mt-1 font-mono text-base font-bold ${cor}`}>{valor}</dd></div>;
}
