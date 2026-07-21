import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calcularRastreamento } from "@/lib/rastreamento";
import { opComProgressoArgs } from "@/lib/pcp";
import { ehSetor } from "@/lib/setores";
import { TIPO_LABEL } from "@/lib/labels";
import { BotaoImprimir } from "@/components/botao-imprimir";
import { buscarImagensOrganizadas } from "@/lib/upload";

function fData(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}
function fDataHora(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

const TH = "border border-slate-300 bg-slate-100 px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600";
const TD = "border border-slate-300 px-2 py-1.5 text-[12px] text-slate-800";

function CampoManual({ valor, largura = "w-24" }: { valor?: string | null; largura?: string }) {
  return valor ? (
    <span className="font-semibold text-emerald-700">{valor}</span>
  ) : (
    <span className={`inline-block ${largura} border-b border-slate-400 align-middle`}>&nbsp;</span>
  );
}

export default async function DocumentoOPPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const modoBranco = sp.modo === "branco";
  const opId = Number(id);

  const op = await prisma.oP.findUnique({
    where: { id: opId },
    include: {
      ...opComProgressoArgs.include,
      modelo: {
        include: {
          roteiro: { include: { setor: true }, orderBy: { ordem: "asc" } },
          pecas: {
            include: {
              peca: {
                include: {
                  setor: true,
                  roteiro: { include: { setor: true }, orderBy: { ordem: "asc" } },
                  curvas: { orderBy: { ordem: "asc" } },
                },
              },
            },
          },
        },
      },
      recebimentosAgrupamento: { include: { setorOrigem: true } },
    },
  });
  if (!op) notFound();

  const imagensOrganizadas = await buscarImagensOrganizadas(
    op.modelo.codigo,
    op.modelo.pecas.map((mp) => mp.peca.codigo),
  );
  const imagemModelo = op.modelo.imagemUrl ?? imagensOrganizadas.modelo;

  const rastreio = calcularRastreamento([op])[0];
  const producao = op.apontamentos.filter((a) => a.soldador === null);
  const envios = op.apontamentos.filter((a) => a.soldador !== null);
  const inicioReal = producao.length
    ? producao.reduce((m, a) => (a.dataHora < m ? a.dataHora : m), producao[0].dataHora)
    : null;
  const tudoCompleto = rastreio.kitsCompletos >= op.quantidade;
  const fimReal =
    tudoCompleto && producao.length
      ? producao.reduce((m, a) => (a.dataHora > m ? a.dataHora : m), producao[0].dataHora)
      : null;
  const totalEnviado = envios.reduce((s, e) => s + e.quantidadeBoa, 0);
  const soldadores = [...new Set(envios.map((e) => e.soldador).filter(Boolean))] as string[];

  const recebimentoDoSetor = (setorId: number) =>
    op.recebimentosAgrupamento.find((r) => r.setorOrigemId === setorId) ?? null;

  const operadoresDaPeca = (pecaId: number, setorId: number) => {
    const doSetor = producao.filter((a) => a.pecaId === pecaId && a.setorId === setorId);
    const nomes = [...new Set(doSetor.map((a) => a.usuario))];
    const ultima = doSetor.length
      ? doSetor.reduce((m, a) => (a.dataHora > m ? a.dataHora : m), doSetor[0].dataHora)
      : null;
    const aprovadas = doSetor.reduce((s, a) => s + a.quantidadeBoa, 0);
    return { nomes, ultima, aprovadas };
  };

  return (
    <div className="min-h-full w-full bg-slate-200 p-6 print:bg-white print:p-0">
      {/* Barra de controle — some na impressão */}
      <div className="nao-imprimir mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/ops"
            className="rounded border border-slate-500 bg-white/80 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-white"
          >
            ← OPs
          </Link>
          <span className="text-sm font-semibold text-slate-700">
            Documento da OP {op.numeroSequencia} · {op.modelo.codigo}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/ops/${op.id}/documento`}
            className={`rounded px-3 py-2 text-[11px] font-bold uppercase tracking-wider ${
              !modoBranco ? "bg-slate-800 text-white" : "border border-slate-500 bg-white/80 text-slate-700 hover:bg-white"
            }`}
          >
            Com progresso
          </Link>
          <Link
            href={`/ops/${op.id}/documento?modo=branco`}
            className={`rounded px-3 py-2 text-[11px] font-bold uppercase tracking-wider ${
              modoBranco ? "bg-slate-800 text-white" : "border border-slate-500 bg-white/80 text-slate-700 hover:bg-white"
            }`}
          >
            Em branco
          </Link>
          <BotaoImprimir />
        </div>
      </div>

      {/* ============ FOLHA 1 — CAPA ============ */}
      <section className="folha-op mx-auto mb-6 max-w-4xl rounded bg-white p-8 font-sans text-slate-900 shadow-lg print:mb-0 print:max-w-none print:rounded-none print:shadow-none">
        <table className="w-full">
          <thead className="print:table-header-group">
            <tr>
              <td>
                <CabecalhoOP
                  op={op}
                  inicioReal={modoBranco ? null : inicioReal}
                  fimReal={modoBranco ? null : fimReal}
                />
                <h2 className="mb-2 mt-6 border-b-2 border-slate-800 pb-1 text-sm font-bold uppercase tracking-wide">
                  Roteiro de produção
                </h2>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={TH}>Código</th>
              <th className={TH}>Item</th>
              <th className={`${TH} text-right`}>Qtd</th>
              <th className={`${TH} text-right`}>Qtd total</th>
              <th className={`${TH} text-center`}>Checklist recebimento</th>
              <th className={`${TH} text-center`}>Checklist abastecimento</th>
            </tr>
          </thead>
          <tbody>
            {op.modelo.pecas.map((mp) => {
              const rec = modoBranco ? null : recebimentoDoSetor(mp.peca.setorId);
              return (
                <tr key={mp.id}>
                  <td className={`${TD} font-mono font-bold`}>{mp.peca.codigo}</td>
                  <td className={TD}>
                    {mp.peca.nome}
                    {mp.peca.medida ? ` · ${mp.peca.medida}` : ""}
                  </td>
                  <td className={`${TD} text-right`}>{mp.quantidadeNecessaria}</td>
                  <td className={`${TD} text-right font-bold`}>
                    {mp.quantidadeNecessaria * op.quantidade}
                  </td>
                  <td className={`${TD} text-center`}>
                    {rec ? (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        ☑ {rec.recebidoPor} · {rec.localizacao}
                      </span>
                    ) : (
                      <span className="text-slate-400">☐</span>
                    )}
                  </td>
                  <td className={`${TD} text-center`}>
                    {!modoBranco && totalEnviado > 0 ? (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        ☑ {totalEnviado}/{op.quantidade} · {soldadores.join(", ")}
                      </span>
                    ) : (
                      <span className="text-slate-400">☐</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {imagemModelo && (
          <div className="mt-6">
            <h2 className="mb-2 border-b-2 border-slate-800 pb-1 text-sm font-bold uppercase tracking-wide">
              Desenho técnico — conjunto completo
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagemModelo}
              alt={`Conjunto ${op.modelo.codigo}`}
              className="mx-auto max-h-72 object-contain"
            />
          </div>
        )}
        
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ============ UMA FOLHA POR PEÇA (AGRUPADA POR SETOR) ============ */}
      {rastreio.setores
        .filter((s) => !ehSetor(s.setorNome, "Agrupamento"))
        .map((setor) =>
          setor.pecas.map((peca, idx) => {
            const mp = op.modelo.pecas.find((x) => x.pecaId === peca.id);
            const dadosPeca = mp?.peca;
            const imagemPeca = dadosPeca?.imagemUrl ?? imagensOrganizadas.pecas.get(peca.codigo);
            const info = modoBranco
              ? { nomes: [], ultima: null, aprovadas: 0 }
              : operadoresDaPeca(peca.id, setor.setorId);
            
            return (
              <section
                key={peca.chave}
                className="folha-op mx-auto mb-6 max-w-4xl rounded bg-white p-8 font-sans text-slate-900 shadow-lg print:mb-0 print:max-w-none print:rounded-none print:shadow-none print:break-before-page"
              >
                <CabecalhoOP
                  op={op}
                  inicioReal={modoBranco ? null : inicioReal}
                  fimReal={modoBranco ? null : fimReal}
                />
                
                <div className="mb-2 mt-6 flex items-center justify-between border-b-2 border-slate-800 pb-1">
                  <h2 className="text-sm font-bold uppercase tracking-wide">
                    Roteiro de produção — {setor.setorNome}
                  </h2>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white print:border-2 print:border-slate-800 print:bg-white print:text-black">
                    ITEM {idx + 1} DE {setor.pecas.length}
                  </span>
                </div>

                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>Código</th>
                      <th className={TH}>Item</th>
                      <th className={`${TH} text-right`}>Qtd</th>
                      <th className={`${TH} text-right`}>Qtd total</th>
                      <th className={TH}>Processo / apontamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={`${TD} font-mono font-bold`}>{peca.codigo}</td>
                      <td className={TD}>{peca.nome}</td>
                      <td className={`${TD} text-right`}>{peca.porEngate}</td>
                      <td className={`${TD} text-right font-bold`}>{peca.necessaria}</td>
                      <td className={`${TD} p-0`}>
                        {peca.processos.map((proc) => (
                          <div
                            key={proc.codigo}
                            className="flex items-center justify-between border-b border-slate-200 px-2 py-1 text-[12px] last:border-0"
                          >
                            <span className="font-semibold">{proc.nome}</span>
                            {modoBranco ? (
                              <span className="text-[11px] text-slate-500">
                                Qtd: <CampoManual largura="w-12" /> Horário: <CampoManual largura="w-16" />
                              </span>
                            ) : (
                              <span
                                className={`text-[11px] font-semibold ${
                                  proc.estado === "concluido" ? "text-emerald-700" : "text-amber-700"
                                }`}
                              >
                                {proc.quantidade}/{proc.necessaria}
                                {proc.estado === "concluido" ? " ✓" : ""}
                              </span>
                            )}
                          </div>
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {dadosPeca && (
                  <table className="mt-2 w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={TH}>Ficha</th>
                        <th className={`${TH} text-right`}>Cpmt (mm)</th>
                        <th className={`${TH} text-right`}>Medida</th>
                        <th className={`${TH} text-right`}>Esp (mm)</th>
                        <th className={`${TH} text-right`}>Quant.</th>
                        <th className={TH}>Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={`${TD} font-semibold`}>
                          {dadosPeca.tipoMaterial ? TIPO_LABEL[dadosPeca.tipoMaterial] ?? dadosPeca.tipoMaterial : dadosPeca.nome}
                        </td>
                        <td className={`${TD} text-right`}>{dadosPeca.comprimentoMm ?? "—"}</td>
                        <td className={`${TD} text-right`}>
                          {dadosPeca.medidaA
                            ? dadosPeca.medidaB
                              ? `${dadosPeca.medidaA}x${dadosPeca.medidaB}`
                              : dadosPeca.medidaA
                            : dadosPeca.medida ?? "—"}
                        </td>
                        <td className={`${TD} text-right`}>{dadosPeca.espessuraMm ?? "—"}</td>
                        <td className={`${TD} text-right`}>{peca.porEngate}</td>
                        <td className={`${TD} uppercase`}>{dadosPeca.observacao ?? ""}</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {dadosPeca && dadosPeca.curvas.length > 0 && (
                  <table className="mt-2 w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={TH}>Dobra</th>
                        <th className={`${TH} text-right`}>Medida (cm)</th>
                        <th className={`${TH} text-right`}>Ângulo (grau)</th>
                        <th className={`${TH} text-right`}>Quant.</th>
                        <th className={TH}>Máq.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dadosPeca.curvas.map((curva) => (
                        <tr key={curva.id}>
                          <td className={`${TD} font-semibold`}>Curva {curva.ordem}</td>
                          <td className={`${TD} text-right`}>{curva.medidaCm ?? "—"}</td>
                          <td className={`${TD} text-right`}>{curva.anguloGraus ?? "—"}</td>
                          <td className={`${TD} text-right`}>{curva.quantidade}</td>
                          <td className={TD}>{curva.maquina ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <table className="mt-2 w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>Apontamento</th>
                      <th className={`${TH} text-right`}>Peças aprovadas</th>
                      <th className={`${TH} text-right`}>Reprovadas</th>
                      <th className={`${TH} text-right`}>Qtd total</th>
                      <th className={TH}>Operador</th>
                      <th className={TH}>Último registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={`${TD} font-mono font-bold`}>{peca.codigo}</td>
                      <td className={`${TD} text-right`}>
                        {modoBranco ? <CampoManual largura="w-14" /> : info.aprovadas}
                      </td>
                      <td className={`${TD} text-right`}>
                        <CampoManual largura="w-14" />
                      </td>
                      <td className={`${TD} text-right font-bold`}>{peca.necessaria}</td>
                      <td className={TD}>
                        {modoBranco ? <CampoManual largura="w-28" /> : info.nomes.join(", ") || <CampoManual largura="w-28" />}
                      </td>
                      <td className={TD}>
                        {!modoBranco && info.ultima ? fDataHora(info.ultima) : <CampoManual largura="w-24" />}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {imagemPeca && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagemPeca}
                    alt={`Desenho ${peca.codigo}`}
                    className="mx-auto mt-3 max-h-56 object-contain"
                  />
                )}

                <div className="mt-3 flex items-center gap-4 border border-slate-300 px-3 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Check</span>
                  {peca.processos.map((proc) => (
                    <span key={proc.codigo} className="text-[11px]">
                      {!modoBranco && proc.estado === "concluido" ? "☑" : "☐"} {proc.nome}
                    </span>
                  ))}
                  <span className="text-[11px]">
                    {!modoBranco && totalEnviado > 0 ? "☑" : "☐"} Abast
                  </span>
                  <span className="text-[11px]">
                    {(() => {
                      const rec = modoBranco ? null : recebimentoDoSetor(setor.setorId);
                      return rec ? `☑ Prateleira: ${rec.localizacao}` : "☐ Prateleira";
                    })()}
                  </span>
                </div>
              </section>
            );
          })
        )}

      {/* ============ FOLHA FINAL — MONTAGEM ============ */}
      <section className="folha-op mx-auto max-w-4xl rounded bg-white p-8 font-sans text-slate-900 shadow-lg print:max-w-none print:rounded-none print:shadow-none print:break-before-page">
        <table className="w-full">
          <thead className="print:table-header-group">
            <tr>
              <td>
                <CabecalhoOP
                  op={op}
                  inicioReal={modoBranco ? null : inicioReal}
                  fimReal={modoBranco ? null : fimReal}
                />
                <h2 className="mb-2 mt-6 border-b-2 border-slate-800 pb-1 text-sm font-bold uppercase tracking-wide">
                  Roteiro da montagem
                </h2>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {imagemModelo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagemModelo}
            alt={`Montagem ${op.modelo.codigo}`}
            className="mx-auto max-h-80 object-contain"
          />
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            Cadastre a foto do engate para imprimir o desenho da montagem.
          </p>
        )}
        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr>
              <th className={TH}>Apontamento da montagem</th>
              <th className={`${TH} text-right`}>Montadas</th>
              <th className={`${TH} text-right`}>Qtd total</th>
              <th className={TH}>Operador</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${TD} font-mono font-bold`}>{op.modelo.codigo}</td>
              <td className={`${TD} text-right`}>
                {(() => {
                  if (modoBranco) return <CampoManual largura="w-14" />;
                  const setorMontagem = op.modelo.roteiro.find((r) => ehSetor(r.setor.nome, "Montagem"));
                  const montadas = setorMontagem
                    ? producao
                        .filter((a) => a.setorId === setorMontagem.setorId)
                        .reduce((s, a) => s + a.quantidadeBoa, 0)
                    : 0;
                  return montadas;
                })()}
              </td>
              <td className={`${TD} text-right font-bold`}>{op.quantidade}</td>
              <td className={TD}>
                <CampoManual largura="w-40" />
              </td>
            </tr>
          </tbody>
        </table>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CabecalhoOP({
  op,
  inicioReal,
  fimReal,
}: {
  op: {
    numeroSequencia: number;
    lote: string | null;
    quantidade: number;
    dataLiberacao: Date;
    previsaoEntrega: Date | null;
    modelo: { codigo: string; nome: string | null; imagemUrl: string | null };
  };
  inicioReal: Date | null;
  fimReal: Date | null;
}) {
  return (
    <div className="border-2 border-slate-800 flex">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between border-b-2 border-slate-800 px-3 py-2">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/uploads/logo/logoBrucke.png" 
              alt="Brucke" 
              className="h-9 object-contain grayscale print:grayscale-0" 
            />
            <span className="text-lg font-bold uppercase tracking-wide">Ordem de produção</span>
          </div>
          <span className="text-right">
            <span className="block text-[10px] font-bold uppercase text-slate-500">Nº ordem de produção</span>
            <span className="font-mono text-xl font-bold">
              {op.numeroSequencia}
              {op.lote ? ` · ${op.lote}` : ""}
            </span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-3 py-2 text-[12px] sm:grid-cols-3">
          <p>
            <span className="font-bold uppercase text-slate-500">Código: </span>
            <span className="font-mono font-bold">{op.modelo.codigo}</span>
          </p>
          <p className="sm:col-span-2">
            <span className="font-bold uppercase text-slate-500">Descrição: </span>
            {op.modelo.nome ?? "—"}
          </p>
          <p>
            <span className="font-bold uppercase text-slate-500">Quantidade: </span>
            <span className="font-bold">{op.quantidade}</span>
          </p>
          <p>
            <span className="font-bold uppercase text-slate-500">Liberação: </span>
            {fData(op.dataLiberacao)}
          </p>
          <p>
            <span className="font-bold uppercase text-slate-500">Previsão entrega: </span>
            {fData(op.previsaoEntrega) ?? <CampoManual largura="w-20" />}
          </p>
          <p>
            <span className="font-bold uppercase text-slate-500">Data de início: </span>
            {inicioReal ? fData(inicioReal) : <CampoManual largura="w-20" />}
          </p>
          <p>
            <span className="font-bold uppercase text-slate-500">Data de finalização: </span>
            {fimReal ? fData(fimReal) : <CampoManual largura="w-20" />}
          </p>
        </div>
      </div>
      
      {op.modelo.imagemUrl && (
        <div className="w-48 shrink-0 border-l-2 border-slate-800 bg-white p-2 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={op.modelo.imagemUrl} 
            alt="Engate Mestre" 
            className="max-h-24 object-contain"
          />
        </div>
      )}
    </div>
  );
}
