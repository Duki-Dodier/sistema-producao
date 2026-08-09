import { prisma } from "@/lib/prisma";
import { calcularProgressoOPs } from "@/lib/pcp";
import { AgrupamentoRow } from "@/components/agrupamento-row";
import { ehSetor, ehSetorFinal } from "@/lib/setores";

export default async function AgrupamentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim().toLowerCase();

  const setores = await prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } });
  const setorSolda = setores.find((setor) => ehSetor(setor.nome, "Solda"));

  const [ops, enviosSolda, soldadoresCadastrados, recebimentos] = await Promise.all([
    prisma.oP.findMany({
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
    }),
    setorSolda
      ? prisma.apontamento.findMany({
          where: { setorId: setorSolda.id },
          select: { soldador: true, bancada: true, abastecedor: true },
          orderBy: { dataHora: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    setorSolda
      ? prisma.funcionario.findMany({
          where: { setorId: setorSolda.id, ativo: true },
          select: { nome: true },
          orderBy: { nome: "asc" },
        })
      : Promise.resolve([]),
    prisma.recebimentoAgrupamento.findMany({
      where: { op: { status: "ABERTA" } },
      orderBy: { dataHora: "desc" },
    }),
  ]);

  // Sugestões de preenchimento do card de envio (nomes/bancadas já usados).
  const sugestoes = {
    soldadores: [
      ...new Set([
        ...soldadoresCadastrados.map((funcionario) => funcionario.nome),
        ...(enviosSolda.map((e) => e.soldador).filter(Boolean) as string[]),
      ]),
    ],
    bancadas: [...new Set(enviosSolda.map((e) => e.bancada).filter(Boolean) as string[])],
    abastecedores: [...new Set(enviosSolda.map((e) => e.abastecedor).filter(Boolean) as string[])],
  };

  let progresso = calcularProgressoOPs(ops).sort(
    (a, b) => a.op.numeroSequencia - b.op.numeroSequencia,
  );

  if (busca) {
    progresso = progresso.filter((p) => {
      const alvo = `${p.op.numeroSequencia} ${p.op.lote ?? ""} ${p.op.modelo.codigo}`.toLowerCase();
      return alvo.includes(busca);
    });
  }

  // No Agrupamento mostramos apenas as famílias que precisam ser conferidas
  // no kit. Plasma Tubo é a etapa de corte da ponteira removível e Acessórios
  // não entra como uma coluna separada nesta conferência.
  const colunas = setores
    .filter(
      (setor) =>
        !ehSetorFinal(setor.nome) &&
        !ehSetor(setor.nome, "Plasma Tubo") &&
        !ehSetor(setor.nome, "Acessórios"),
    )
    .map((setor) => ({
      chave: ehSetor(setor.nome, "Componente Reforço")
        ? "REFORCO"
        : ehSetor(setor.nome, "Ponteira")
          ? "PONTEIRA"
          : `SETOR:${setor.id}`,
      setorId: setor.id,
      setorNome: ehSetor(setor.nome, "Componente Barra Chata e Cantoneira")
        ? "COMPONENTE BARRA CHATA E CANTONEIRA"
        : ehSetor(setor.nome, "Componente Reforço")
          ? "COMPONENTE REFORÇO"
          : ehSetor(setor.nome, "Ponteira")
            ? "PONTEIRA"
            : setor.nome.toLocaleUpperCase("pt-BR"),
      ordemPadrao: setor.ordemPadrao,
    }))
    .sort((a, b) => a.ordemPadrao - b.ordemPadrao);

  // Cálculos para os Cards Superiores
  const totalWIP = progresso.reduce((acc, p) => acc + p.op.quantidade, 0);
  const delayedOps = progresso.filter(p => p.foraDeSequencia).length;
  // Apenas exemplo para o card de Produção Diária (usaria apontamentos reais de hoje)
  const dailyProduction = Math.round(totalWIP * 0.3);

  return (
    <div className="flex flex-col gap-6 font-sans w-full p-6 bg-[#242D3C] min-h-full">
      
      {/* 1. CARDS DE MÉTRICAS (DASHBOARD TOP) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CARD: TOTAL WIP */}
        <div className="rounded-lg bg-[#2C3645] border border-white/5 p-4 flex flex-col justify-between shadow-lg">
           <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total WIP (Peças em Produção)</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth={2}><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
           </div>
           <div className="flex items-end justify-between">
              <span className="text-3xl font-light text-white">{totalWIP.toLocaleString('pt-BR')}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-16 text-emerald-500" strokeWidth={2}><polyline points="2 12 8 8 14 14 22 4"></polyline></svg>
           </div>
        </div>

        {/* CARD: OPs ATRASADAS */}
        <div className="rounded-lg bg-[#2C3645] border border-white/5 p-4 flex flex-col justify-between shadow-lg">
           <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">OPs Atrasadas / Em Alerta</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4 text-red-500" strokeWidth={2}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
           </div>
           <div className="flex items-end justify-between">
              <span className="text-3xl font-light text-red-400">{delayedOps}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-16 text-red-500" strokeWidth={2}><polyline points="2 4 8 10 14 6 22 14"></polyline></svg>
           </div>
        </div>

        {/* CARD: PRODUÇÃO DIÁRIA */}
        <div className="rounded-lg bg-[#2C3645] border border-white/5 p-4 flex flex-col justify-between shadow-lg">
           <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Produção Diária (Estimada)</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth={2}><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
           </div>
           <div className="flex items-end justify-between">
              <span className="text-3xl font-light text-white">{dailyProduction} <span className="text-lg text-slate-500">unids</span></span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-16 text-emerald-500" strokeWidth={2}><polyline points="2 12 8 8 14 14 22 4"></polyline></svg>
           </div>
        </div>

      </div>

      {/* 2. TOOLBAR DA TABELA */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-2 bg-[#202A36] p-2 rounded-t-lg border border-white/5 border-b-0">
         <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 rounded bg-[#2C3645] border border-slate-600 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
              Ações em Lote
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3 w-3" strokeWidth={2}><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
         </div>
         
         <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5" strokeWidth={2}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              Filtrar
            </button>
            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Exportar
            </button>
            <form className="relative w-64" method="get">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" strokeWidth={2}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
               <input
                 name="busca"
                 defaultValue={sp.busca ?? ""}
                 placeholder="Pesquisar..."
                 className="w-full rounded bg-[#1A222C] border border-slate-700 py-1.5 pl-8 pr-3 text-[11px] text-slate-200 placeholder-slate-500 focus:border-[#3B82F6] focus:outline-none transition-colors"
               />
            </form>
         </div>
      </div>

      {/* 3. TABELA ESTILO ENTERPRISE */}
      <div className="overflow-x-auto rounded-b-lg border border-white/5 bg-[#202A36]">
        <table className="w-full text-left text-[10px] text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-[#1A222C] text-slate-400">
              <th className="px-3 py-3 w-8">
                <input type="checkbox" className="rounded border-slate-600 bg-transparent text-[#3B82F6] focus:ring-0 cursor-pointer" />
              </th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap border-r border-white/5">Nº OP</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap border-r border-white/5">Código SKU</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap border-r border-white/5">Qtd</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap border-r border-white/5">Data Lanc.</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap border-r border-white/5">Curva</th>
              {colunas.map((c) => (
                <th key={c.chave} className="px-3 py-3 font-semibold whitespace-nowrap border-r border-white/5">
                  STATUS: {c.setorNome.toLocaleUpperCase("pt-BR")}
                </th>
              ))}
              <th className="px-3 py-3 font-semibold whitespace-nowrap border-r border-white/5 text-center">Envio p/ Solda</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap">Falta Enviar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {progresso.map((p, index) => (
              <AgrupamentoRow
                key={p.op.id}
                p={p}
                colunas={colunas}
                index={index}
                sugestoes={sugestoes}
                recebimentos={recebimentos.filter((item) => item.opId === p.op.id)}
              />
            ))}
            {progresso.length === 0 && (
              <tr>
                <td colSpan={colunas.length + 8} className="px-5 py-16 text-center text-slate-500 uppercase tracking-widest text-[11px] font-semibold">
                  Nenhuma ordem de produção em andamento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
