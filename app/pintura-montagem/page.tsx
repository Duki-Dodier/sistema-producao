import Link from "next/link";
import { Factory, PackageCheck, Paintbrush, Wrench } from "lucide-react";
import { FechamentoPinturaForm, MovimentoLinhaFinalForm } from "@/components/linha-final-forms";
import { exigirUsuarioLogado } from "@/lib/auth-operador";
import { prisma } from "@/lib/prisma";
import { ehSetor } from "@/lib/setores";

type Aba = "visao" | "pintura" | "montagem" | "estoque" | "historico";

function chaveData(data: Date) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valor.year}-${valor.month}-${valor.day}`;
}

function dataHora(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

function dataCurta(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
  }).format(data);
}

function soma(itens: { quantidadeBoa: number }[]) {
  return itens.reduce((total, item) => total + item.quantidadeBoa, 0);
}

function CardKpi({
  titulo,
  valor,
  detalhe,
  cor = "text-cyan-300",
  icon: Icon,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  cor?: string;
  icon: typeof Factory;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#192331] p-4 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{titulo}</p>
          <p className={`mt-2 text-3xl font-bold ${cor}`}>{valor}</p>
          <p className="mt-1 text-xs text-slate-400">{detalhe}</p>
        </div>
        <Icon className={`h-5 w-5 ${cor}`} />
      </div>
    </div>
  );
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/8 bg-[#192331] shadow-lg shadow-black/10">
      <div className="border-b border-white/8 bg-[#151e2b] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-bold text-slate-100">{titulo}</h2>
        {descricao && <p className="mt-1 text-xs leading-5 text-slate-400">{descricao}</p>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export default async function PinturaMontagemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const abaInformada = String(sp.aba ?? "visao");
  const aba: Aba = ["visao", "pintura", "montagem", "estoque", "historico"].includes(abaInformada)
    ? (abaInformada as Aba)
    : "visao";
  const usuario = await exigirUsuarioLogado();
  const podePintar = usuario.administrador || usuario.papel === "PCP" || ehSetor(usuario.setorNome, "Pintura");
  const podeMontar = usuario.administrador || usuario.papel === "PCP" || ehSetor(usuario.setorNome, "Montagem");

  const setores = await prisma.setor.findMany({ select: { id: true, nome: true } });
  const solda = setores.find((setor) => ehSetor(setor.nome, "Solda"));
  const pintura = setores.find((setor) => ehSetor(setor.nome, "Pintura"));
  const montagem = setores.find((setor) => ehSetor(setor.nome, "Montagem"));
  if (!solda || !pintura || !montagem) {
    return (
      <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-5 text-sm text-rose-200">
        Cadastre os setores Solda, Pintura e Montagem nas Configurações para ativar este fluxo.
      </div>
    );
  }

  const [ops, fechamentos, distribuicoesPintura, historicoMovimentos, entradasEstoque] = await Promise.all([
    prisma.oP.findMany({
      where: { status: "ABERTA" },
      orderBy: [{ numeroSequencia: "asc" }, { id: "asc" }],
      select: {
        id: true,
        numeroSequencia: true,
        lote: true,
        quantidade: true,
        modelo: { select: { codigo: true, nome: true, linhaProduto: true } },
        apontamentos: {
          where: { setorId: { in: [solda.id, pintura.id, montagem.id] }, pecaId: null },
          select: { setorId: true, quantidadeBoa: true, soldador: true },
        },
        entradasEstoque: { select: { quantidade: true } },
      },
    }),
    prisma.fechamentoPintura.findMany({ orderBy: { data: "desc" } }),
    prisma.apontamento.findMany({
      where: { setorId: pintura.id, pecaId: null },
      select: { quantidadeBoa: true, op: { select: { modelo: { select: { linhaProduto: true } } } } },
    }),
    prisma.apontamento.findMany({
      where: { setorId: { in: [pintura.id, montagem.id] }, pecaId: null },
      orderBy: { dataHora: "desc" },
      take: 60,
      select: {
        id: true,
        setorId: true,
        quantidadeBoa: true,
        usuario: true,
        dataHora: true,
        op: { select: { numeroSequencia: true, modelo: { select: { codigo: true, linhaProduto: true } } } },
      },
    }),
    prisma.entradaEstoque.findMany({
      orderBy: { dataHora: "desc" },
      take: 60,
      select: {
        id: true,
        quantidade: true,
        usuario: true,
        dataHora: true,
        op: { select: { numeroSequencia: true, modelo: { select: { codigo: true, linhaProduto: true } } } },
      },
    }),
  ]);

  const filas = ops.map((op) => {
    const soldado = soma(op.apontamentos.filter((item) => item.setorId === solda.id && item.soldador === null));
    const pintado = soma(op.apontamentos.filter((item) => item.setorId === pintura.id));
    const montado = soma(op.apontamentos.filter((item) => item.setorId === montagem.id));
    const estoque = op.entradasEstoque.reduce((total, item) => total + item.quantidade, 0);
    return {
      ...op,
      soldado: Math.min(soldado, op.quantidade),
      pintado,
      montado,
      estoque,
      saldoPintura: Math.max(Math.min(soldado, op.quantidade) - pintado, 0),
      saldoMontagem: Math.max(pintado - montado, 0),
      saldoEstoque: Math.max(montado - estoque, 0),
    };
  });

  const totalFechado = {
    BRUCKE: fechamentos.reduce((total, item) => total + item.quantidadeBrucke, 0),
    REFORCEL: fechamentos.reduce((total, item) => total + item.quantidadeReforcel, 0),
  };
  const totalDistribuido = {
    BRUCKE: distribuicoesPintura
      .filter((item) => item.op.modelo.linhaProduto === "BRUCKE")
      .reduce((total, item) => total + item.quantidadeBoa, 0),
    REFORCEL: distribuicoesPintura
      .filter((item) => item.op.modelo.linhaProduto === "REFORCEL")
      .reduce((total, item) => total + item.quantidadeBoa, 0),
  };
  const saldoLinha = {
    BRUCKE: Math.max(totalFechado.BRUCKE - totalDistribuido.BRUCKE, 0),
    REFORCEL: Math.max(totalFechado.REFORCEL - totalDistribuido.REFORCEL, 0),
  };
  const filaPintura = filas.filter((item) => item.saldoPintura > 0);
  const filaMontagem = filas.filter((item) => item.saldoMontagem > 0);
  const filaEstoque = filas.filter((item) => item.saldoEstoque > 0);
  const hoje = chaveData(new Date());
  const fechamentoHoje = fechamentos.find((item) => chaveData(item.data) === hoje);

  const abas: { id: Aba; nome: string; contador?: number }[] = [
    { id: "visao", nome: "Visão geral" },
    { id: "pintura", nome: "Pintura", contador: filaPintura.length },
    { id: "montagem", nome: "Montagem", contador: filaMontagem.length },
    { id: "estoque", nome: "Saída para Estoque", contador: filaEstoque.length },
    { id: "historico", nome: "Histórico" },
  ];

  return (
    <div className="min-h-full bg-[#202a36] p-3 sm:p-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-400">Linha final</p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Pintura / Montagem</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            A Pintura fecha o dia por BRUCKE e REFORCEL. Depois, as peças são liberadas por OP para a Montagem, que pode montar e enviar ao Estoque em quantidades parciais.
          </p>
        </header>

        <nav className="flex gap-2 overflow-x-auto rounded-xl border border-white/8 bg-[#192331] p-2">
          {abas.map((item) => (
            <Link
              key={item.id}
              href={`/pintura-montagem?aba=${item.id}`}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition sm:text-sm ${
                aba === item.id ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.nome}
              {item.contador !== undefined && (
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">{item.contador}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CardKpi titulo="Aguardando Pintura" valor={filaPintura.reduce((t, i) => t + i.saldoPintura, 0)} detalhe={`${filaPintura.length} OP(s) com saldo soldado`} icon={Paintbrush} cor="text-sky-300" />
          <CardKpi titulo="Aguardando Montagem" valor={filaMontagem.reduce((t, i) => t + i.saldoMontagem, 0)} detalhe={`${filaMontagem.length} OP(s) liberadas`} icon={Wrench} cor="text-amber-300" />
          <CardKpi titulo="Prontos para Estoque" valor={filaEstoque.reduce((t, i) => t + i.saldoEstoque, 0)} detalhe={`${filaEstoque.length} OP(s) com montagem parcial`} icon={PackageCheck} cor="text-emerald-300" />
          <CardKpi titulo="OPs na linha final" valor={filas.filter((i) => i.soldado > i.estoque).length} detalhe="Da Solda até a entrada no Estoque" icon={Factory} />
        </div>

        {aba === "visao" && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Secao titulo="Saldo pintado ainda não distribuído" descricao="Disponível no fechamento da Pintura para vincular às OPs.">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/8 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-300">BRUCKE</p>
                    <p className="mt-2 text-3xl font-bold text-white">{saldoLinha.BRUCKE}</p>
                  </div>
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/8 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-300">REFORCEL</p>
                    <p className="mt-2 text-3xl font-bold text-white">{saldoLinha.REFORCEL}</p>
                  </div>
                </div>
              </Secao>
              <Secao titulo="Como o fluxo funciona" descricao="O controle separa o fechamento físico da cabine e a rastreabilidade por OP.">
                <ol className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                  <li className="rounded-lg bg-white/[0.03] p-3"><b className="text-sky-300">1. Pintura</b><br /><span className="text-xs text-slate-400">Fecha BRUCKE e REFORCEL e identifica as OPs liberadas.</span></li>
                  <li className="rounded-lg bg-white/[0.03] p-3"><b className="text-amber-300">2. Montagem</b><br /><span className="text-xs text-slate-400">Confirma a quantidade realmente montada, inclusive parcial.</span></li>
                  <li className="rounded-lg bg-white/[0.03] p-3"><b className="text-emerald-300">3. Estoque</b><br /><span className="text-xs text-slate-400">Recebe parcialmente e conclui a OP ao atingir o total.</span></li>
                </ol>
              </Secao>
            </div>
            <Secao titulo="OPs em andamento na linha final" descricao="Visão rápida do avanço de cada OP entre Solda, Pintura, Montagem e Estoque.">
              <TabelaFluxo filas={filas.filter((item) => item.soldado > item.estoque)} />
            </Secao>
          </>
        )}

        {aba === "pintura" && (
          <>
            <Secao titulo="Fechamento diário da Pintura" descricao="Informe o total bom e o refugo das duas linhas. Se já existir fechamento nesta data, ele será atualizado.">
              {podePintar ? (
                <FechamentoPinturaForm
                  data={hoje}
                  quantidadeBrucke={fechamentoHoje?.quantidadeBrucke}
                  quantidadeReforcel={fechamentoHoje?.quantidadeReforcel}
                  refugoBrucke={fechamentoHoje?.refugoBrucke}
                  refugoReforcel={fechamentoHoje?.refugoReforcel}
                />
              ) : (
                <p className="text-sm text-amber-300">Seu usuário pode consultar, mas somente Pintura ou PCP pode fechar a produção.</p>
              )}
            </Secao>
            <Secao titulo="Identificar peças pintadas por OP" descricao="A quantidade precisa ter saldo soldado na OP e saldo no fechamento BRUCKE ou REFORCEL.">
              <FilaOperacional
                filas={filaPintura}
                etapa="PINTURA"
                podeOperar={podePintar}
                saldoLinha={saldoLinha}
              />
            </Secao>
          </>
        )}

        {aba === "montagem" && (
          <Secao titulo="Fila da Montagem" descricao="Confirme somente o que foi montado. A quantidade pode ser parcial e o restante continuará na fila.">
            <FilaOperacional filas={filaMontagem} etapa="MONTAGEM" podeOperar={podeMontar} saldoLinha={saldoLinha} />
          </Secao>
        )}

        {aba === "estoque" && (
          <Secao titulo="Saída da Montagem para o Estoque" descricao="Envie parcialmente. Ao completar a quantidade da OP, o sistema registra a data e finaliza automaticamente a ordem.">
            <FilaOperacional filas={filaEstoque} etapa="ESTOQUE" podeOperar={podeMontar} saldoLinha={saldoLinha} />
          </Secao>
        )}

        {aba === "historico" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Secao titulo="Fechamentos da Pintura" descricao="Últimos fechamentos por dia e por linha.">
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-white/8 text-left text-[10px] uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">Data</th><th className="px-3 py-2">Brucke</th><th className="px-3 py-2">Reforcel</th><th className="px-3 py-2">Refugo</th><th className="pl-3 py-2">Responsável</th></tr></thead><tbody className="divide-y divide-white/5">{fechamentos.slice(0, 30).map((item) => <tr key={item.id}><td className="py-3 pr-3 text-slate-300">{dataCurta(item.data)}</td><td className="px-3 py-3 font-bold text-blue-300">{item.quantidadeBrucke}</td><td className="px-3 py-3 font-bold text-violet-300">{item.quantidadeReforcel}</td><td className="px-3 py-3 text-slate-400">{item.refugoBrucke + item.refugoReforcel}</td><td className="pl-3 py-3 text-slate-400">{item.usuario}</td></tr>)}</tbody></table></div>
            </Secao>
            <Secao titulo="Movimentações por OP" descricao="Liberações da Pintura e apontamentos da Montagem.">
              <div className="space-y-2">{historicoMovimentos.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] p-3 text-xs"><div><p className="font-bold text-slate-200">OP {item.op.numeroSequencia} · {item.op.modelo.codigo}</p><p className="mt-1 text-slate-500">{dataHora(item.dataHora)} · {item.usuario}</p></div><div className="text-right"><p className={item.setorId === pintura.id ? "font-bold text-sky-300" : "font-bold text-amber-300"}>{item.setorId === pintura.id ? "PINTURA → MONTAGEM" : "MONTAGEM"}</p><p className="mt-1 text-lg font-bold text-white">{item.quantidadeBoa}</p></div></div>)}{historicoMovimentos.length === 0 && <p className="text-sm text-slate-500">Nenhuma movimentação registrada.</p>}</div>
            </Secao>
            <Secao titulo="Entradas no Estoque" descricao="Histórico das remessas parciais e finais.">
              <div className="space-y-2">{entradasEstoque.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] p-3 text-xs"><div><p className="font-bold text-slate-200">OP {item.op.numeroSequencia} · {item.op.modelo.codigo}</p><p className="mt-1 text-slate-500">{dataHora(item.dataHora)} · {item.usuario}</p></div><p className="text-lg font-bold text-emerald-300">+{item.quantidade}</p></div>)}{entradasEstoque.length === 0 && <p className="text-sm text-slate-500">Nenhuma entrada registrada.</p>}</div>
            </Secao>
          </div>
        )}
      </div>
    </div>
  );
}

type Fila = {
  id: number;
  numeroSequencia: number;
  lote: string | null;
  quantidade: number;
  modelo: { codigo: string; nome: string | null; linhaProduto: string };
  soldado: number;
  pintado: number;
  montado: number;
  estoque: number;
  saldoPintura: number;
  saldoMontagem: number;
  saldoEstoque: number;
};

function TabelaFluxo({ filas }: { filas: Fila[] }) {
  if (filas.length === 0) return <p className="py-4 text-center text-sm text-slate-500">Nenhuma OP em andamento na linha final.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="border-b border-white/8 text-left text-[10px] uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">OP / Modelo</th><th className="px-3 py-2">Linha</th><th className="px-3 py-2 text-center">Total OP</th><th className="px-3 py-2 text-center">Soldado</th><th className="px-3 py-2 text-center">Pintado</th><th className="px-3 py-2 text-center">Montado</th><th className="pl-3 py-2 text-center">Estoque</th></tr></thead>
        <tbody className="divide-y divide-white/5">{filas.map((item) => <tr key={item.id} className="hover:bg-white/[0.02]"><td className="py-3 pr-3"><p className="font-bold text-white">OP {item.numeroSequencia} · {item.modelo.codigo}</p><p className="mt-0.5 text-xs text-slate-500">Lote {item.lote ?? "—"}</p></td><td className="px-3 py-3 text-xs font-bold text-cyan-300">{item.modelo.linhaProduto}</td><td className="px-3 py-3 text-center text-slate-300">{item.quantidade}</td><td className="px-3 py-3 text-center text-sky-300">{item.soldado}</td><td className="px-3 py-3 text-center text-blue-300">{item.pintado}</td><td className="px-3 py-3 text-center text-amber-300">{item.montado}</td><td className="pl-3 py-3 text-center font-bold text-emerald-300">{item.estoque}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function FilaOperacional({
  filas,
  etapa,
  podeOperar,
  saldoLinha,
}: {
  filas: Fila[];
  etapa: "PINTURA" | "MONTAGEM" | "ESTOQUE";
  podeOperar: boolean;
  saldoLinha: { BRUCKE: number; REFORCEL: number };
}) {
  if (filas.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">Nenhuma OP aguardando esta etapa.</p>;
  }
  return (
    <div className="space-y-3">
      {filas.map((item) => {
        const linha = item.modelo.linhaProduto === "REFORCEL" ? "REFORCEL" : "BRUCKE";
        const saldo = etapa === "PINTURA"
          ? Math.min(item.saldoPintura, saldoLinha[linha])
          : etapa === "MONTAGEM"
            ? item.saldoMontagem
            : item.saldoEstoque;
        return (
          <article key={item.id} className="grid gap-4 rounded-xl border border-white/8 bg-[#121b28] p-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-white">OP {item.numeroSequencia} · {item.modelo.codigo}</h3>
                <span className={`rounded px-2 py-1 text-[10px] font-bold ${linha === "BRUCKE" ? "bg-blue-500/15 text-blue-300" : "bg-violet-500/15 text-violet-300"}`}>{linha}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Lote {item.lote ?? "—"} · Total da OP: {item.quantidade}</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <MiniValor nome="Solda" valor={item.soldado} />
              <MiniValor nome="Pintura" valor={item.pintado} />
              <MiniValor nome="Montagem" valor={item.montado} />
              <MiniValor nome="Estoque" valor={item.estoque} />
            </div>
            <div className="lg:min-w-[300px]">
              <p className="mb-2 text-xs text-slate-400">Saldo disponível: <b className="text-white">{saldo}</b></p>
              {podeOperar ? (
                <MovimentoLinhaFinalForm opId={item.id} saldo={saldo} movimento={etapa === "PINTURA" ? "LIBERAR" : etapa === "MONTAGEM" ? "MONTAR" : "ESTOQUE"} />
              ) : (
                <p className="text-xs text-amber-300">Somente o setor responsável ou PCP pode registrar.</p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MiniValor({ nome, valor }: { nome: string; valor: number }) {
  return <div className="rounded-lg bg-white/[0.03] p-2"><p className="text-[9px] uppercase tracking-wide text-slate-500">{nome}</p><p className="mt-1 font-bold text-slate-200">{valor}</p></div>;
}
