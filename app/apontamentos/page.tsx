import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ehSetor } from "@/lib/setores";
import { processosDaPeca, PROCESSO_LABEL, PROCESSOS } from "@/lib/processos";
import {
  OperadorApontamentoKiosk,
  type ItemApontamentoOperador,
} from "@/components/operador-apontamento-kiosk";
import { HistoricoApontamentos } from "@/components/historico-apontamentos";
import { buscarOperadorLogado } from "@/lib/auth-operador";

export default async function ApontamentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const setores = await prisma.setor.findMany({ orderBy: { ordemPadrao: "asc" } });
  const setorId = sp.setor ? Number(sp.setor) : setores[0]?.id;
  const setor = setores.find((item) => item.id === setorId) ?? setores[0];
  const opIdFiltro = sp.op ? Number(sp.op) : null;
  const pecaIdFiltro = sp.peca ? Number(sp.peca) : null;
  const modoQr = sp.origem === "qrcode" || (Number.isInteger(opIdFiltro) && sp.origem !== "pc");
  const quantidadeInicial = sp.quantidade ? Number(sp.quantidade) : null;
  const quantidadeInicialValida = typeof quantidadeInicial === "number" && Number.isInteger(quantidadeInicial) && quantidadeInicial > 0
    ? quantidadeInicial
    : null;

  if (!setor) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Apontamentos da Fábrica" subtitle="Nenhum setor cadastrado." />
      </div>
    );
  }

  const operadorLogado = await buscarOperadorLogado();
  if (Number.isInteger(opIdFiltro) && !operadorLogado) {
    const destinoParams = new URLSearchParams({ op: String(opIdFiltro), setor: String(setor.id) });
    if (modoQr) destinoParams.set("origem", "qrcode");
    if (Number.isInteger(pecaIdFiltro)) destinoParams.set("peca", String(pecaIdFiltro));
    if (quantidadeInicialValida !== null) {
      destinoParams.set("quantidade", String(quantidadeInicialValida));
    }
    const destino = `/apontamentos?${destinoParams.toString()}`;
    redirect(`/login?redirect=${encodeURIComponent(destino)}`);
  }
  if (
    operadorLogado &&
    operadorLogado.papel !== "PCP" &&
    operadorLogado.setorId !== setor.id
  ) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Setor não autorizado"
          subtitle={`Você está conectado como ${operadorLogado.nome} · ${operadorLogado.setorNome}.`}
        />
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-100">
          Este usuário só pode apontar processos do próprio setor. Volte pelo QR Code da OP ou selecione o posto correto.
          <div className="mt-4">
            <Link
              href={`/apontamentos?setor=${operadorLogado.setorId}`}
              className="inline-flex rounded-lg border border-amber-300/40 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-amber-200"
            >
              Ir para {operadorLogado.setorNome}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const setorSolda = ehSetor(setor.nome, "Solda");
  const [funcionarios, autorizadores, opsAbertas, recentes] = await Promise.all([
    prisma.funcionario.findMany({
      where: {
        setorId: setor.id,
        ativo: true,
        ...(operadorLogado && operadorLogado.papel !== "PCP"
          ? { id: operadorLogado.id }
          : {}),
      },
      select: {
        id: true,
        nome: true,
        pin: true,
        papel: true,
        processosPermitidos: { select: { processo: true } },
      },
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
      take: 100,
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
          pecaCodigo: "OP SEM BOM",
          pecaNome: `Produção geral da OP · ${setor.nome}`,
          necessario: op.quantidade,
          processos: [{
            codigo: "PRODUCAO",
            label: "Produção geral",
            apontado,
            estado: concluido ? "concluido" : "atual",
          }],
          proximoProcesso: null,
          proximoLabel: "Produção geral",
          restante: Math.max(op.quantidade - apontado, 0),
          concluido,
        }];
      }

      const pecasDoSetor = op.modelo.pecas.filter(
        (modeloPeca) =>
          modeloPeca.peca.setorId === setor.id ||
          modeloPeca.peca.roteiro.some((etapa) => etapa.setorId === setor.id),
      );
      if (pecasDoSetor.length === 0) return [];

      return pecasDoSetor.flatMap((modeloPeca): ItemApontamentoOperador[] => {
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
        const ultimaEtapaDeProducao = [...etapas]
          .reverse()
          .find((etapa) => etapa.processo !== "AGRUPAR");
        if (concluido && ultimaEtapaDeProducao?.setorId !== setor.id) return [];

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
  const itensVisiveis = itens.filter((item) =>
    (!Number.isInteger(opIdFiltro) || item.opId === opIdFiltro) &&
    (!Number.isInteger(pecaIdFiltro) || item.pecaId === pecaIdFiltro),
  );

  const historico = recentes.map((apontamento) => {
    const processoLabel = apontamento.processo
      ? PROCESSO_LABEL[apontamento.processo as keyof typeof PROCESSO_LABEL] ?? apontamento.processo
      : "Finalização";
    const ultimoAjuste = apontamento.ajustes[0] ?? null;
    return {
      id: apontamento.id,
      dataHora: apontamento.dataHora.toISOString(),
      opNumero: apontamento.op.numeroSequencia,
      modeloCodigo: apontamento.op.modelo.codigo,
      pecaCodigo: apontamento.peca?.codigo ?? null,
      pecaNome: apontamento.peca?.nome ?? null,
      processo: apontamento.processo,
      processoLabel,
      usuario: apontamento.usuario,
      quantidadeBoa: apontamento.quantidadeBoa,
      setorId: apontamento.setorId,
      setorNome: apontamento.setor.nome,
      ultimoAjuste: ultimoAjuste
        ? {
            valorAnterior: ultimoAjuste.valorAnterior,
            valorNovo: ultimoAjuste.valorNovo,
            autorizadoPor: ultimoAjuste.autorizadoPor.nome,
            motivo: ultimoAjuste.motivo,
          }
        : null,
    };
  });

  return (
    <div className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6">
      <PageHeader
        title="Apontamentos da Fábrica"
        subtitle="Tela simples do operador · OP, peça, processo atual e quantidade executada."
      />

      <div className="flex items-center gap-2 overflow-x-auto rounded-lg border border-slate-700 bg-[#131b2e] p-3">
        <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {modoQr ? "Setor do QR" : "Posto / setor"}
        </span>
        {modoQr ? (
          <span className="whitespace-nowrap rounded border border-[#4cd7f6] bg-[#4cd7f6]/10 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#4cd7f6]">
            {setor.nome}
          </span>
        ) : (
          setores.map((opcao) => (
            <Link
              key={opcao.id}
              href={`/apontamentos?setor=${opcao.id}`}
              className={`whitespace-nowrap rounded px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition ${
                opcao.id === setor.id
                  ? "border border-[#4cd7f6] bg-[#4cd7f6]/10 text-[#4cd7f6]"
                  : "border border-slate-700 bg-[#060e20] text-slate-400 hover:text-white"
              }`}
            >
              {opcao.nome}
            </Link>
          ))
        )}
      </div>

      <OperadorApontamentoKiosk
        setorId={setor.id}
        setorNome={setor.nome}
        operadores={funcionarios.map((f) => ({
          id: f.id,
          nome: f.nome,
          temPin: Boolean(f.pin),
          processosPermitidos: f.papel === "OPERADOR"
            ? f.processosPermitidos.map((item) => item.processo)
          : [...PROCESSOS],
        }))}
        sessao={operadorLogado ? {
          id: operadorLogado.id,
          nome: operadorLogado.nome,
          temPin: operadorLogado.temPin,
          processosPermitidos: operadorLogado.papel === "OPERADOR"
            ? operadorLogado.processosPermitidos
            : [...PROCESSOS],
        } : undefined}
        itens={itensVisiveis}
        opIdInicial={Number.isInteger(opIdFiltro) ? opIdFiltro : null}
        pecaIdInicial={Number.isInteger(pecaIdFiltro) ? pecaIdFiltro : null}
        quantidadeInicial={quantidadeInicialValida}
        modoQr={modoQr}
      />

      <HistoricoApontamentos
        setorNome={setor.nome}
        apontamentos={historico}
        autorizadores={listaAutorizadores}
      />
    </div>
  );
}
