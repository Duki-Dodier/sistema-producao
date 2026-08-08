"use client";

import { useState } from "react";
import type { OPProgresso, SetorProgresso } from "@/lib/pcp";
import { PecasModal } from "./pecas-modal";
import { EnvioSoldaModal } from "./envio-solda-modal";
import { ehSetor, ehSetorFinal } from "@/lib/setores";

export type ColunaAgrupamento = {
  chave: string;
  setorId: number;
  setorNome: string;
  ordemPadrao: number;
};

function normalizar(valor: string | null | undefined) {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
}

function etapaFinalDaPeca(
  peca: OPProgresso["op"]["modelo"]["pecas"][number]["peca"],
) {
  return peca.roteiro
    .filter((etapa) => etapa.processo !== "AGRUPAR" && !ehSetorFinal(etapa.setor.nome))
    .at(-1);
}

function categoriaDaPeca(
  peca: OPProgresso["op"]["modelo"]["pecas"][number]["peca"],
) {
  const nome = normalizar(peca.nome);
  const etapaFinal = etapaFinalDaPeca(peca);
  if (
    peca.tipoMaterial === "REFORCO" ||
    nome.includes("REFORCO") ||
    (etapaFinal && ehSetor(etapaFinal.setor.nome, "Componente Reforço"))
  ) return "REFORCO";
  if (
    peca.tipoMaterial === "PONTEIRA" ||
    nome.includes("PONTEIRA") ||
    nome.includes("CABECA REMOVIVEL") ||
    (etapaFinal && ehSetor(etapaFinal.setor.nome, "Ponteira"))
  ) {
    return "PONTEIRA";
  }
  return `SETOR:${etapaFinal?.setorId ?? peca.setorId}`;
}

function progressoDaColuna(p: OPProgresso, coluna: ColunaAgrupamento): SetorProgresso | null {
  const itens = p.op.modelo.pecas.filter(
    (modeloPeca) => categoriaDaPeca(modeloPeca.peca) === coluna.chave,
  );
  if (itens.length === 0) return null;

  const pecas = itens.map((modeloPeca) => {
    const etapaFinal = etapaFinalDaPeca(modeloPeca.peca);
    const setorFinalId = etapaFinal?.setorId ?? modeloPeca.peca.setorId;
    const progressoSetor = p.setoresPreSolda.find((setor) => setor.setorId === setorFinalId);
    const progressoPeca = progressoSetor?.pecas.find(
      (peca) => peca.pecaId === modeloPeca.pecaId,
    );
    const necessaria = p.op.quantidade * modeloPeca.quantidadeNecessaria;
    return progressoPeca ?? {
      pecaId: modeloPeca.pecaId,
      codigo: modeloPeca.peca.codigo,
      nome: modeloPeca.peca.nome,
      medida: modeloPeca.peca.medida,
      necessaria,
      produzida: 0,
      falta: necessaria,
      completo: false,
    };
  });
  const completo = pecas.every((peca) => peca.completo);
  const datasConclusao = itens
    .map((modeloPeca) => {
      const setorId = etapaFinalDaPeca(modeloPeca.peca)?.setorId ?? modeloPeca.peca.setorId;
      return p.setoresPreSolda.find((setor) => setor.setorId === setorId)?.concluidoEm ?? null;
    })
    .filter((data): data is Date => data !== null);
  const setorRepresentante = etapaFinalDaPeca(itens[0].peca)?.setorId ?? coluna.setorId;

  return {
    setorId: setorRepresentante,
    setorNome: coluna.setorNome,
    ordem: coluna.ordemPadrao,
    ordemPadrao: coluna.ordemPadrao,
    quantidadeBoa: pecas.reduce((soma, peca) => soma + peca.produzida, 0),
    falta: pecas.reduce((soma, peca) => soma + peca.falta, 0),
    completo,
    concluidoEm:
      completo && datasConclusao.length > 0
        ? new Date(Math.max(...datasConclusao.map((data) => data.getTime())))
        : null,
    pecas,
  };
}

// FORMATADOR DE DATA BRASILEIRO
function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const dataObj = new Date(d);
  return `${String(dataObj.getDate()).padStart(2, '0')}/${String(dataObj.getMonth() + 1).padStart(2, '0')}/${dataObj.getFullYear()}`;
}

// FORMATADOR DE HORA
function formatTime(d: Date | string | null): string {
  if (!d) return "";
  const dataObj = new Date(d);
  const h = String(dataObj.getHours()).padStart(2, '0');
  const m = String(dataObj.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function StatusBadge({ 
  status, 
  date,
  percentual = 0
}: { 
  status: 'completed' | 'progress' | 'delayed' | 'pending'; 
  date?: Date | null;
  percentual?: number;
}) {
  let bgColor = "bg-[#2A3645]";
  let textColor = "text-slate-400";
  let text = "PENDENTE";
  let barColor = "bg-slate-600";
  const timeStr = date ? formatTime(date) : "";
  const displayPercent = Math.min(Math.max(percentual, 0), 100);

  if (status === 'completed') {
    bgColor = "bg-[#14532D]";
    textColor = "text-[#4ADE80]";
    text = `CONCLUÍDO - ${timeStr}`;
    barColor = "bg-[#4ADE80]";
  } else if (status === 'delayed') {
    bgColor = "bg-[#7F1D1D]";
    textColor = "text-[#F87171]";
    text = `ATRASADO - ${timeStr}`;
    barColor = "bg-[#F87171]";
  } else if (status === 'progress') {
    bgColor = "bg-[#78350F]";
    textColor = "text-[#FBBF24]";
    text = `EM ANDAMENTO - ${displayPercent}%`;
    barColor = "bg-[#FBBF24]";
  }

  if (status === 'pending') {
    return <div className="text-slate-400 text-[10px] text-center w-full block">NÃO INICIADO</div>;
  }

  return (
    <div className="flex flex-col w-[130px] mx-auto cursor-pointer group">
      <div className={`w-full rounded px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase flex justify-between ${bgColor} ${textColor} group-hover:brightness-125 transition-all`}>
        <span className="truncate">{text}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
         <div className="h-1 w-full bg-[#1A222C] rounded-full overflow-hidden">
            <div className={`h-full ${barColor}`} style={{ width: `${displayPercent}%` }}></div>
         </div>
         <span className="text-[8px] text-slate-400 font-bold group-hover:text-white transition-colors">{displayPercent}%</span>
      </div>
    </div>
  );
}

export type SugestoesEnvio = {
  soldadores: string[];
  bancadas: string[];
  abastecedores: string[];
};

export type RecebimentoDaCelula = {
  id: number;
  opId: number;
  setorOrigemId: number;
  categoria: string;
  recebidoPor: string;
  localizacao: string;
  dataHora: Date | string;
};

export function AgrupamentoRow({
  p,
  colunas,
  index,
  sugestoes,
  recebimentos,
}: {
  p: OPProgresso;
  colunas: ColunaAgrupamento[];
  index: number;
  sugestoes: SugestoesEnvio;
  recebimentos: RecebimentoDaCelula[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [envioOpen, setEnvioOpen] = useState(false);
  const [setorSelecionado, setSetorSelecionado] = useState<SetorProgresso | null>(null);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);

  const bgClass = index % 2 === 0 ? "bg-[#202A36]" : "bg-[#242D3C]"; // Efeito Zebra
  const dateStr = formatDate(p.op.dataLiberacao);

  // Progresso de envio p/ Solda (soma dos envios já feitos)
  const setorSolda = p.setores.find(s => ehSetor(s.setorNome, "Solda"));
  // Abastecimento vindo do Agrupamento tem `soldador` preenchido. Um
  // apontamento com `soldador` nulo é quantidade já soldada, não novo envio.
  const enviado = setorSolda
    ? p.op.apontamentos
        .filter(
          (apontamento) =>
            apontamento.setorId === setorSolda.setorId && apontamento.soldador !== null,
        )
        .reduce((soma, apontamento) => soma + apontamento.quantidadeBoa, 0)
    : 0;
  const saldoAProduzir = p.op.quantidade - enviado;

  const openModal = (coluna: ColunaAgrupamento) => {
     const setorObj = progressoDaColuna(p, coluna);
     if (setorObj) {
        setSetorSelecionado(setorObj);
        setCategoriaSelecionada(coluna.chave);
        setModalOpen(true);
     }
  };

  return (
    <>
      <tr className={`hover:bg-[#2C3645] transition-colors ${bgClass}`}>
        <td className="px-3 py-3 border-r border-white/5">
          <input type="checkbox" className="rounded border-slate-600 bg-transparent text-[#3B82F6] focus:ring-0 cursor-pointer" />
        </td>
        <td className="px-3 py-3 border-r border-white/5 font-semibold text-slate-200">
          {p.op.numeroSequencia}
        </td>
        <td className="px-3 py-3 border-r border-white/5 text-slate-300 font-medium">
          {p.op.modelo.codigo}
        </td>
        <td className="px-3 py-3 border-r border-white/5 text-slate-300">
          {p.op.quantidade}
        </td>
        <td className="px-3 py-3 border-r border-white/5 text-slate-400 whitespace-nowrap">
          {dateStr}
        </td>
        <td className="px-3 py-3 border-r border-white/5 text-center">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#374151] text-[10px] font-bold text-slate-300 border border-slate-600">
            {p.op.modelo.curva || "-"}
          </span>
        </td>
        
        {colunas.map((c) => {
          const s = progressoDaColuna(p, c);
          const recebimento = recebimentos.find((item) => item.categoria === c.chave);
          
          if (!s) {
            return (
              <td key={c.chave} className="px-3 py-2 border-r border-white/5 text-center">
                 <span className="text-slate-400">—</span>
              </td>
            );
          }

          let badgeStatus: 'completed' | 'progress' | 'delayed' | 'pending' = 'pending';
          const latestDate = s.concluidoEm;
          let percent = 0;

          if (s.quantidadeBoa > 0 || (s.pecas.length > 0 && s.pecas.some(peca => peca.produzida > 0))) {
             if (s.completo) {
                badgeStatus = 'completed';
                percent = 100;
             } else {
                badgeStatus = p.foraDeSequencia ? 'delayed' : 'progress';
                
                if (s.pecas.length > 0) {
                   const totalNec = s.pecas.reduce((acc, pc) => acc + pc.necessaria, 0);
                   const totalProd = s.pecas.reduce((acc, pc) => acc + pc.produzida, 0);
                   percent = totalNec > 0 ? Math.round((totalProd / totalNec) * 100) : 0;
                } else {
                   percent = Math.round((s.quantidadeBoa / p.op.quantidade) * 100);
                }
             }
          }

          const temMaterial =
            s.quantidadeBoa > 0 || s.pecas.some((peca) => peca.produzida > 0);
          const aguardandoRecebimento = temMaterial && !recebimento;
          const destaqueRecebimento = recebimento
            ? "ring-2 ring-inset ring-emerald-400/70 bg-emerald-400/5"
            : aguardandoRecebimento
              ? "ring-2 ring-inset ring-amber-400 bg-amber-400/10"
              : "";

          return (
            <td 
              key={c.chave}
              className={`px-3 py-2 border-r border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${destaqueRecebimento}`}
              onClick={() => openModal(c)}
              title="Clique para ver as peças deste setor"
            >
               <StatusBadge status={badgeStatus} date={latestDate} percentual={percent} />
               {recebimento && (
                 <div className="mt-1 truncate text-center text-[8px] font-bold uppercase tracking-wide text-emerald-300">
                   Recebido · {recebimento.localizacao}
                 </div>
               )}
            </td>
          );
        })}

        <td className="px-3 py-3 border-r border-white/5 text-center">
          {p.prontoParaSolda && saldoAProduzir > 0 ? (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setEnvioOpen(true)}
                className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-500 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3 w-3" strokeWidth={2.5}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                Enviar p/ Solda
              </button>
              {enviado > 0 && (
                <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400">
                  {enviado}/{p.op.quantidade} enviadas
                </span>
              )}
            </div>
          ) : enviado > 0 && saldoAProduzir <= 0 ? (
            <span className="inline-flex items-center rounded bg-[#14532D] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#4ADE80]">
              100% Enviada
            </span>
          ) : (
            <span className="text-[9px] uppercase tracking-wider text-slate-500" title="O kit precisa estar 100% completo para enviar">
              Kit incompleto
            </span>
          )}
        </td>

        <td className="px-3 py-3 border-r border-white/5 text-center text-slate-300 font-medium">
          {saldoAProduzir > 0 ? saldoAProduzir : "-"}
        </td>
      </tr>

      {/* MODAIS EMBUTIDOS */}
      {modalOpen && (
        <PecasModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          opId={p.op.id}
          opNum={p.op.numeroSequencia}
          modeloCodigo={p.op.modelo.codigo}
          imagemUrl={p.op.modelo.imagemUrl}
          setor={setorSelecionado}
          categoria={categoriaSelecionada}
          recebimento={
            categoriaSelecionada
              ? recebimentos.find((item) => item.categoria === categoriaSelecionada) ?? null
              : null
          }
        />
      )}
      {envioOpen && (
        <EnvioSoldaModal
          isOpen={envioOpen}
          onClose={() => setEnvioOpen(false)}
          opId={p.op.id}
          opNum={p.op.numeroSequencia}
          modeloCodigo={p.op.modelo.codigo}
          quantidadeOP={p.op.quantidade}
          saldo={saldoAProduzir}
          sugestoes={sugestoes}
        />
      )}
    </>
  );
}
