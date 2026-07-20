import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import { formatDateTime } from "@/lib/format";
import { ehSetor } from "@/lib/setores";
import { processosDaPeca, PROCESSO_LABEL } from "@/lib/processos";
import {
  OperadorApontamentoKiosk,
  type ItemApontamentoOperador,
} from "@/components/operador-apontamento-kiosk";
import { AjustarApontamentoBotao } from "@/components/ajustar-apontamento-botao";

export default async function ApontamentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const setores = await prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } });
  const setorId = sp.setor ? Number(sp.setor) : setores[0]?.id;
  const setor = setores.find((item) => item.id === setorId) ?? setores[0];

  if (!setor) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Apontamentos da Fábrica" subtitle="Nenhum setor cadastrado." />
      </div>
    );
  }

  const setorSolda = ehSetor(setor.nome, "Solda");
  const [funcionarios, autorizadores, opsAbertas, recentes] = await Promise.all([
    prisma.funcionario.findMany({
      where: { setorId: setor.id, ativo: true },
      select: { id: true, nome: true, pin: true },
      orderBy: { nome: "asc" },
    }),
    prisma.funcionario.findMany({
      where: { ativo: true, papel: { in: ["LIDER", "PCP"] } },
      select: {
        id: true,
        nome: true,
        papel: true,
        setorId: true,
        pin: true,
        setor: { select: { nome: true } },
      },
      orderBy: { nome: "asc" },
    }),
    prisma.oP.findMany({
      where: {
        status: "ABERTA",
        modelo: {
          OR: [
            { roteiro: { some: { setorId: setor.id } } },
            { pecas: { some: { peca: { roteiro: { some: { setorId: setor.id } } } } } },
          ],
        },
      },
      orderBy: { numeroSequencia: "asc" },
      select: {
        id: true,
        numeroSequencia: true,
        quantidade: true,
        apontamentos: {
          where: {
            ...(setorSolda ? { soldador: null } : {}),
          },
          select: {
            setorId: true,
            pecaId: true,
            processo: true,
            roteiroEtapaId: true,
            quantidadeBoa: true,
          },
        },
        modelo: {
          select: {
            codigo: true,
            pecas: {
              where: {
                peca: {
                  OR: [
                    { setorId: setor.id },
                    { roteiro: { some: { setorId: setor.id } } },
                  ],
                },
              },
              select: {
                pecaId: true,
                quantidadeNecessaria: true,
                peca: {
                  select: {
                    codigo: true,
                    nome: true,
                    setorId: true,
                    processos: true,
                    tipoMaterial: true,
                    setor: { select: { nome: true } },
                    roteiro: {
                      orderBy: { ordem: "asc" },
                      select: {
                        id: true,
                        setorId: true,
                        processo: true,
                        ordem: true,
                        setor: { select: { nome: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.apontamento.findMany({
      where: { setorId: setor.id },
      orderBy: { dataHora: "desc" },
      take: 20,
      include: {
        op: { include: { modelo: true } },
        setor: true,
        peca: true,
        ajustes: {
          orderBy: { dataHora: "desc" },
          include: { autorizadoPor: { select: { nome: true } } },
        },
      },
    }),
  ]);

  const listaAutorizadores = autorizadores.map((a) => ({
    id: a.id,
    nome: a.nome,
    papel: a.papel,
    setorId: a.setorId,
    setorNome: a.setor.nome,
    temPin: Boolean(a.pin),
  }));

  const itens: ItemApontamentoOperador[] = opsAbertas.flatMap(
    (op): ItemApontamentoOperador[] => {
      if (op.modelo.pecas.length === 0) {
        const apontado = op.apontamentos
          .filter((item) => item.pecaId === null && item.setorId === setor.id)
          .reduce((soma, item) => soma + item.quantidadeBoa, 0);
        const concluido = apontado >= op.quantidade;
        return [{
          chave: `${op.id}-setor`,
          opId: op.id,
          numeroSequencia: op.numeroSequencia,
          modeloCodigo: op.modelo.codigo,
          pecaId: null,
          roteiroEtapaId: null,
          pecaCodigo: "PRODUÇÃO",
          pecaNome: `Produção de ${setor.nome}`,
          necessario: op.quantidade,
          processos: [{
            codigo: "PRODUCAO",
            label: "Produção",
            apontado,
            estado: concluido ? "concluido" : "atual",
          }],
          proximoProcesso: null,
          proximoLabel: "Produção",
          restante: Math.max(op.quantidade - apontado, 0),
          concluido,
        }];
      }

      return op.modelo.pecas.flatMap((modeloPeca): ItemApontamentoOperador[] => {
        const necessario = op.quantidade * modeloPeca.quantidadeNecessaria;
        const etapas = modeloPeca.peca.roteiro.length > 0
          ? modeloPeca.peca.roteiro
          : processosDaPeca(modeloPeca.peca).map((processo, indice) => ({
              id: null,
              setorId: modeloPeca.peca.setorId,
              processo,
              ordem: indice + 1,
              setor: modeloPeca.peca.setor,
            }));
        const legado = op.apontamentos
          .filter((item) => item.pecaId === modeloPeca.pecaId && item.processo === null)
          .reduce((soma, item) => soma + item.quantidadeBoa, 0);
        const quantidades = new Map(
          etapas.map((etapa) => [
            etapa.id ?? `${etapa.setorId}-${etapa.processo}-${etapa.ordem}`,
            legado + op.apontamentos
              .filter((item) =>
                item.pecaId === modeloPeca.pecaId &&
                (etapa.id
                  ? item.roteiroEtapaId === etapa.id ||
                    (item.roteiroEtapaId === null && item.processo === etapa.processo)
                  : item.processo === etapa.processo) &&
                (item.roteiroEtapaId !== null || item.setorId === etapa.setorId),
              )
              .reduce((soma, item) => soma + item.quantidadeBoa, 0),
          ]),
        );
        const indiceAtual = etapas.findIndex(
          (etapa) => (quantidades.get(etapa.id ?? `${etapa.setorId}-${etapa.processo}-${etapa.ordem}`) ?? 0) < necessario,
        );
        const concluido = indiceAtual === -1;
        const etapaAtual = concluido ? null : etapas[indiceAtual];
        if (!concluido && etapaAtual?.setorId !== setor.id) return [];
        if (concluido && etapas.at(-1)?.setorId !== setor.id) return [];

        return [{
          chave: `${op.id}-${modeloPeca.pecaId}`,
          opId: op.id,
          numeroSequencia: op.numeroSequencia,
          modeloCodigo: op.modelo.codigo,
          pecaId: modeloPeca.pecaId,
          roteiroEtapaId: etapaAtual?.id ?? null,
          pecaCodigo: modeloPeca.peca.codigo,
          pecaNome: modeloPeca.peca.nome,
          necessario,
          processos: etapas.map((etapa, indice) => ({
            codigo: String(etapa.id ?? `${etapa.setorId}-${etapa.processo}-${etapa.ordem}`),
            label: `${etapa.setor.nome} · ${PROCESSO_LABEL[etapa.processo as keyof typeof PROCESSO_LABEL] ?? etapa.processo}`,
            apontado: quantidades.get(etapa.id ?? `${etapa.setorId}-${etapa.processo}-${etapa.ordem}`) ?? 0,
            estado: (concluido || indice < indiceAtual
              ? "concluido"
              : indice === indiceAtual
                ? "atual"
                : "futuro") as "concluido" | "atual" | "futuro",
          })),
          proximoProcesso: etapaAtual?.processo ?? null,
          proximoLabel: etapaAtual
            ? PROCESSO_LABEL[etapaAtual.processo as keyof typeof PROCESSO_LABEL] ?? etapaAtual.processo
            : "Concluído",
          restante: etapaAtual
            ? Math.max(
                necessario -
                  (quantidades.get(etapaAtual.id ?? `${etapaAtual.setorId}-${etapaAtual.processo}-${etapaAtual.ordem}`) ?? 0),
                0,
              )
            : 0,
          concluido,
        }];
      });
    },
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Apontamentos da Fábrica"
        subtitle="Tela simples do operador · OP, peça, processo atual e quantidade executada."
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-[#131b2e] p-3">
        <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Posto / setor
        </span>
        {setores.map((opcao) => (
          <Link
            key={opcao.id}
            href={`/apontamentos?setor=${opcao.id}`}
            className={`rounded px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition ${
              opcao.id === setor.id
                ? "border border-[#4cd7f6] bg-[#4cd7f6]/10 text-[#4cd7f6]"
                : "border border-slate-700 bg-[#060e20] text-slate-400 hover:text-white"
            }`}
          >
            {opcao.nome}
          </Link>
        ))}
      </div>

      <OperadorApontamentoKiosk
        setorId={setor.id}
        setorNome={setor.nome}
        operadores={funcionarios.map((f) => ({
          id: f.id,
          nome: f.nome,
          temPin: Boolean(f.pin),
        }))}
        itens={itens}
      />

      <Card>
        <CardHeader title={`Últimos apontamentos · ${setor.nome}`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Data/hora</th>
                <th className="px-5 py-3">OP</th>
                <th className="px-5 py-3">Peça</th>
                <th className="px-5 py-3">Processo</th>
                <th className="px-5 py-3">Operador</th>
                <th className="px-5 py-3 text-right">Quantidade</th>
                <th className="px-5 py-3 text-right">Correção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentes.map((apontamento) => {
                const processoLabel = apontamento.processo
                  ? PROCESSO_LABEL[apontamento.processo as keyof typeof PROCESSO_LABEL] ?? apontamento.processo
                  : "Finalização";
                const ultimoAjuste = apontamento.ajustes[0] ?? null;
                return (
                  <tr key={apontamento.id} className="hover:bg-[#2C3645]">
                    <td className="px-5 py-3 text-slate-500">{formatDateTime(apontamento.dataHora)}</td>
                    <td className="px-5 py-3 font-mono text-slate-300">
                      OP {apontamento.op.numeroSequencia} · {apontamento.op.modelo.codigo}
                    </td>
                    <td className="px-5 py-3 text-slate-300">
                      {apontamento.peca ? `${apontamento.peca.codigo} · ${apontamento.peca.nome}` : "Produção do setor"}
                    </td>
                    <td className="px-5 py-3 text-slate-400">{processoLabel}</td>
                    <td className="px-5 py-3 text-slate-400">{apontamento.usuario}</td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-400">
                      {apontamento.quantidadeBoa}
                      {ultimoAjuste && (
                        <span
                          className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400"
                          title={`Ajustado de ${ultimoAjuste.valorAnterior} para ${ultimoAjuste.valorNovo} por ${ultimoAjuste.autorizadoPor.nome} — ${ultimoAjuste.motivo}`}
                        >
                          ajustado
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <AjustarApontamentoBotao
                        apontamento={{
                          id: apontamento.id,
                          descricao: `OP ${apontamento.op.numeroSequencia} · ${apontamento.op.modelo.codigo} · ${apontamento.peca ? apontamento.peca.codigo : "Produção"} · ${processoLabel}`,
                          setorId: apontamento.setorId,
                          setorNome: apontamento.setor.nome,
                          quantidadeAtual: apontamento.quantidadeBoa,
                          usuario: apontamento.usuario,
                        }}
                        autorizadores={listaAutorizadores}
                      />
                    </td>
                  </tr>
                );
              })}
              {recentes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Nenhum apontamento neste setor ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
